import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import {
  addDays,
  LESSON_HORIZON_DAYS,
  LessonStatus,
  previousPlanEnd,
  StudentStatus,
  todayIn,
  weekdayOf,
  zonedToUtc,
  type SlotDto,
} from '@aulinha/contracts';
import { Student } from '../alunos/entities/student.entity';
import { Events, type StudentStatusChangedEvent } from '../common/events';
import { TeachersService } from '../professor/teachers.service';
import { CreateSlotDto, UpdateSlotDto } from './dto/agenda.dto';
import { Lesson } from './entities/lesson.entity';
import { RecurringSlot } from './entities/recurring-slot.entity';
import { ScheduleBlock } from './entities/schedule-block.entity';
import { toSlotDto } from './mappers';

@Injectable()
export class SlotsService {
  private readonly logger = new Logger(SlotsService.name);

  constructor(
    @InjectRepository(RecurringSlot) private readonly slots: Repository<RecurringSlot>,
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(ScheduleBlock) private readonly blocks: Repository<ScheduleBlock>,
    private readonly teachers: TeachersService,
  ) {}

  async listForStudent(teacherId: string, studentId: string): Promise<SlotDto[]> {
    await this.ownedStudent(teacherId, studentId, true);
    const today = await this.today(teacherId);
    const slots = await this.slots.find({
      where: [
        { teacherId, studentId, validTo: IsNull() },
        { teacherId, studentId, validTo: MoreThanOrEqual(today) },
      ],
      order: { weekday: 'ASC', startTime: 'ASC' },
    });
    return slots.map(toSlotDto);
  }

  async create(teacherId: string, studentId: string, dto: CreateSlotDto): Promise<SlotDto> {
    await this.ownedStudent(teacherId, studentId);
    const today = await this.today(teacherId);
    await this.assertNoDuplicate(teacherId, studentId, dto.weekday, dto.startTime, today);
    const slot = await this.slots.save(
      this.slots.create({
        teacherId,
        studentId,
        weekday: dto.weekday,
        startTime: dto.startTime,
        durationMin: dto.durationMin,
        mode: dto.mode,
        location: dto.location ?? null,
        meetingUrl: dto.meetingUrl ?? null,
        validFrom: dto.validFrom ?? today,
        validTo: null,
      }),
    );
    await this.generate(teacherId, [slot.id]);
    return toSlotDto(slot);
  }

  /**
   * "Esta e as próximas": a partir de `effectiveFrom` o horário muda.
   * Aulas já marcadas (realizadas, faltas, remarcadas) nunca são tocadas.
   */
  async update(teacherId: string, id: string, dto: UpdateSlotDto): Promise<SlotDto> {
    const slot = await this.owned(teacherId, id);
    const today = await this.today(teacherId);
    const from = dto.effectiveFrom < today ? today : dto.effectiveFrom;
    await this.assertNoDuplicate(teacherId, slot.studentId, dto.weekday, dto.startTime, today, slot.id);
    const fields = {
      weekday: dto.weekday,
      startTime: dto.startTime,
      durationMin: dto.durationMin,
      mode: dto.mode,
      location: dto.location ?? null,
      meetingUrl: dto.meetingUrl ?? null,
    };

    let target: RecurringSlot;
    if (from <= slot.validFrom) {
      Object.assign(slot, fields);
      target = await this.slots.save(slot);
    } else {
      slot.validTo = previousPlanEnd(from);
      await this.slots.save(slot);
      target = await this.slots.save(
        this.slots.create({ ...fields, teacherId, studentId: slot.studentId, validFrom: from, validTo: null }),
      );
    }
    await this.removeFutureScheduled(slot.id, from);
    await this.generate(teacherId, [target.id]);
    return toSlotDto(target);
  }

  /** Encerra o horário: a última aula é a do dia anterior a `from`. */
  async end(teacherId: string, id: string, from: string): Promise<void> {
    const slot = await this.owned(teacherId, id);
    const today = await this.today(teacherId);
    const start = from < today ? today : from;
    if (start <= slot.validFrom) {
      const kept = await this.lessons.count({ where: { slotId: id, status: In(this.markedStatuses()) } });
      await this.removeFutureScheduled(id, slot.validFrom);
      if (!kept) {
        await this.slots.remove(slot);
        return;
      }
      slot.validTo = previousPlanEnd(slot.validFrom);
    } else {
      slot.validTo = previousPlanEnd(start);
    }
    await this.slots.save(slot);
    await this.removeFutureScheduled(id, start);
  }

  /**
   * Materializa as aulas dos horários fixos até `LESSON_HORIZON_DAYS` à frente.
   * Idempotente: o índice único (slot, dia) impede duplicatas.
   */
  async generate(teacherId: string, slotIds?: string[]): Promise<number> {
    const teacher = await this.teachers.findById(teacherId);
    const today = todayIn(teacher.timezone);
    const horizon = addDays(today, LESSON_HORIZON_DAYS);

    const qb = this.slots
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.student', 'st')
      .where('s.teacherId = :teacherId', { teacherId })
      .andWhere('(s.validTo IS NULL OR s.validTo >= :today)', { today })
      .andWhere('s.validFrom <= :horizon', { horizon })
      .andWhere('st.status != :inactive', { inactive: StudentStatus.INATIVO });
    if (slotIds?.length) qb.andWhereInIds(slotIds);
    const slots = await qb.getMany();
    if (!slots.length) return 0;

    const blocks = await this.blocks
      .createQueryBuilder('b')
      .where('b.teacherId = :teacherId AND b.endDate >= :today AND b.startDate <= :horizon', {
        teacherId,
        today,
        horizon,
      })
      .getMany();
    const blocked = (d: string) => blocks.some((b) => b.startDate <= d && d <= b.endDate);

    const rows: Partial<Lesson>[] = [];
    for (const slot of slots) {
      const st = slot.student;
      let d = slot.validFrom > today ? slot.validFrom : today;
      const last = slot.validTo && slot.validTo < horizon ? slot.validTo : horizon;
      // Primeiro dia da semana certo.
      d = addDays(d, (slot.weekday - weekdayOf(d) + 7) % 7);
      for (; d <= last; d = addDays(d, 7)) {
        if (blocked(d)) continue;
        if (st.status === StudentStatus.PAUSADO && (!st.pausedUntil || d <= st.pausedUntil)) continue;
        const startsAt = zonedToUtc(d, slot.startTime, teacher.timezone);
        rows.push({
          teacherId,
          studentId: slot.studentId,
          slotId: slot.id,
          occurrenceDate: d,
          startsAt,
          endsAt: new Date(startsAt.getTime() + slot.durationMin * 60_000),
          status: LessonStatus.AGENDADA,
          mode: slot.mode,
          location: slot.location,
          meetingUrl: slot.meetingUrl,
          chargeable: true,
        });
      }
    }
    if (!rows.length) return 0;
    const result = await this.lessons
      .createQueryBuilder()
      .insert()
      .into(Lesson)
      .values(rows)
      .orIgnore()
      .execute();
    return result.identifiers.filter(Boolean).length;
  }

  /** Mantém sempre 8 semanas de agenda à frente. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async generateAll(): Promise<void> {
    for (const t of await this.teachers.findAll()) {
      const n = await this.generate(t.id);
      if (n) this.logger.log(`${n} aula(s) geradas para ${t.email}`);
    }
  }

  /** Pausa/arquivo remove as aulas futuras ainda não marcadas; reativação gera de novo. */
  @OnEvent(Events.STUDENT_STATUS_CHANGED, { async: true, promisify: true })
  async onStudentStatus(e: StudentStatusChangedEvent): Promise<void> {
    const today = await this.today(e.teacherId);
    if (e.status === StudentStatus.ATIVO) {
      const ids = (await this.slots.find({ where: { studentId: e.studentId }, select: { id: true } })).map((s) => s.id);
      if (ids.length) await this.generate(e.teacherId, ids);
      return;
    }
    const qb = this.lessons
      .createQueryBuilder()
      .delete()
      .where('student_id = :sid AND status = :st AND slot_id IS NOT NULL AND occurrence_date >= :today', {
        sid: e.studentId,
        st: LessonStatus.AGENDADA,
        today,
      });
    if (e.status === StudentStatus.PAUSADO && e.pausedUntil) {
      qb.andWhere('occurrence_date <= :until', { until: e.pausedUntil });
    }
    await qb.execute();
    if (e.status === StudentStatus.PAUSADO && e.pausedUntil) {
      const ids = (await this.slots.find({ where: { studentId: e.studentId }, select: { id: true } })).map((s) => s.id);
      if (ids.length) await this.generate(e.teacherId, ids);
    }
  }

  private async assertNoDuplicate(teacherId: string, studentId: string, weekday: number, startTime: string, today: string, ignoreId?: string) {
    const dup = await this.slots
      .createQueryBuilder('s')
      .where('s.teacherId = :teacherId AND s.studentId = :studentId', { teacherId, studentId })
      .andWhere('s.weekday = :weekday AND s.startTime = :startTime', { weekday, startTime })
      .andWhere('(s.validTo IS NULL OR s.validTo >= :today)', { today })
      .andWhere(ignoreId ? 's.id != :ignoreId' : '1=1', { ignoreId })
      .getCount();
    if (dup) throw new BadRequestException('Esse aluno já tem aula nesse dia e horário');
  }

  private async removeFutureScheduled(slotId: string, from: string) {
    await this.lessons.delete({
      slotId,
      status: LessonStatus.AGENDADA,
      occurrenceDate: MoreThanOrEqual(from),
      markedAt: IsNull(),
    });
  }

  private markedStatuses() {
    return [LessonStatus.REALIZADA, LessonStatus.FALTA_ALUNO, LessonStatus.FALTA_PROFESSOR, LessonStatus.REMARCADA, LessonStatus.CANCELADA];
  }

  private async owned(teacherId: string, id: string) {
    const slot = await this.slots.findOne({ where: { id, teacherId } });
    if (!slot) throw new NotFoundException('Horário não encontrado');
    return slot;
  }

  private async ownedStudent(teacherId: string, id: string, allowInactive = false) {
    const st = await this.students.findOne({ where: { id, teacherId } });
    if (!st) throw new NotFoundException('Aluno não encontrado');
    if (!allowInactive && st.status === StudentStatus.INATIVO) {
      throw new BadRequestException('Reative o aluno para mexer nos horários');
    }
    return st;
  }

  private async today(teacherId: string) {
    return todayIn((await this.teachers.findById(teacherId)).timezone);
  }
}
