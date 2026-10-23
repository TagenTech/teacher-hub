import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import {
  addDays,
  LessonStatus,
  MakeupCreditStatus,
  todayIn,
  zonedToUtc,
  type ScheduleBlockDto,
} from '@aulinha/contracts';
import { TeachersService } from '../professor/teachers.service';
import { CreateScheduleBlockDto } from './dto/agenda.dto';
import { Lesson } from './entities/lesson.entity';
import { MakeupCredit } from './entities/makeup-credit.entity';
import { ScheduleBlock } from './entities/schedule-block.entity';
import { toBlockDto } from './mappers';
import { SlotsService } from './slots.service';

@Injectable()
export class BlocksService {
  constructor(
    @InjectRepository(ScheduleBlock) private readonly blocks: Repository<ScheduleBlock>,
    private readonly teachers: TeachersService,
    private readonly slots: SlotsService,
    private readonly db: DataSource,
  ) {}

  async list(teacherId: string): Promise<ScheduleBlockDto[]> {
    const today = todayIn((await this.teachers.findById(teacherId)).timezone);
    const rows = await this.blocks.find({
      where: { teacherId, endDate: MoreThanOrEqual(addDays(today, -60)) },
      order: { startDate: 'ASC' },
    });
    return rows.map(toBlockDto);
  }

  /** Cria o bloqueio e cancela as aulas agendadas no período. */
  async create(teacherId: string, dto: CreateScheduleBlockDto): Promise<{ block: ScheduleBlockDto; canceled: number }> {
    if (dto.endDate < dto.startDate) throw new BadRequestException('O fim precisa ser depois do início');
    if (addDays(dto.startDate, 366) < dto.endDate) throw new BadRequestException('Bloqueio de no máximo 1 ano');
    const tz = (await this.teachers.findById(teacherId)).timezone;

    return this.db.transaction(async (em) => {
      const block = await em.save(em.create(ScheduleBlock, { teacherId, ...dto }));
      const lessons = await em
        .createQueryBuilder(Lesson, 'l')
        .where('l.teacherId = :teacherId AND l.status = :st', { teacherId, st: LessonStatus.AGENDADA })
        .andWhere('l.startsAt >= :from AND l.startsAt < :to', {
          from: zonedToUtc(dto.startDate, '00:00', tz),
          to: zonedToUtc(addDays(dto.endDate, 1), '00:00', tz),
        })
        .getMany();
      for (const l of lessons) {
        l.status = LessonStatus.CANCELADA;
        l.chargeable = false;
        l.absenceReason = dto.reason;
        l.blockId = block.id;
        l.markedAt = new Date();
        if (l.makeupCreditId) {
          // Uma reposição que cai no bloqueio devolve o crédito.
          await em.update(MakeupCredit, { id: l.makeupCreditId }, { status: MakeupCreditStatus.ABERTO, usedLessonId: null });
          l.makeupCreditId = null;
        } else if (dto.createMakeups) {
          await em.save(
            em.create(MakeupCredit, {
              teacherId,
              studentId: l.studentId,
              originLessonId: l.id,
              reason: dto.reason,
              status: MakeupCreditStatus.ABERTO,
            }),
          );
        }
      }
      await em.save(lessons);
      return { block: toBlockDto(block), canceled: lessons.length };
    });
  }

  /** Remove o bloqueio e devolve as aulas que ele havia cancelado. */
  async remove(teacherId: string, id: string): Promise<void> {
    const block = await this.blocks.findOne({ where: { id, teacherId } });
    if (!block) throw new NotFoundException('Bloqueio não encontrado');
    await this.db.transaction(async (em) => {
      // Só aulas de horário fixo voltam; avulsas/reposições canceladas já devolveram o crédito.
      const lessons = await em.find(Lesson, {
        where: { blockId: id, status: LessonStatus.CANCELADA, slotId: Not(IsNull()) },
      });
      for (const l of lessons) {
        await em.update(
          MakeupCredit,
          { originLessonId: l.id, status: MakeupCreditStatus.ABERTO },
          { status: MakeupCreditStatus.CANCELADO },
        );
        l.status = LessonStatus.AGENDADA;
        l.chargeable = true;
        l.absenceReason = null;
        l.blockId = null;
        l.markedAt = null;
      }
      await em.save(lessons);
      await em.update(Lesson, { blockId: id }, { blockId: null });
      await em.remove(block);
    });
    await this.slots.generate(teacherId);
  }
}
