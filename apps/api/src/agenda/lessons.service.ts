import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  addDays,
  attendanceDefaults,
  BillingPlanType,
  LessonStatus,
  MakeupCreditStatus,
  planAt,
  StudentStatus,
  zonedParts,
  zonedToUtc,
  type LessonDto,
  type MakeupCreditDto,
} from '@turmei/contracts';
import { BillingPlan } from '../alunos/entities/billing-plan.entity';
import { Student } from '../alunos/entities/student.entity';
import { Events, type LessonMarkedEvent } from '../common/events';
import { TeachersService } from '../professor/teachers.service';
import {
  AttendanceDto,
  CreateLessonDto,
  ListLessonsQueryDto,
  ListMakeupQueryDto,
  RescheduleDto,
  UpdateLessonDto,
} from './dto/agenda.dto';
import { Lesson } from './entities/lesson.entity';
import { MakeupCredit } from './entities/makeup-credit.entity';
import { toLessonDto, toMakeupDto } from './mappers';

/** Aulas passadas ainda sem marcação aparecem como pendentes por até este tempo. */
const PENDING_WINDOW_DAYS = 45;

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    @InjectRepository(MakeupCredit) private readonly credits: Repository<MakeupCredit>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(BillingPlan) private readonly plans: Repository<BillingPlan>,
    private readonly teachers: TeachersService,
    private readonly db: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  async list(teacherId: string, q: ListLessonsQueryDto): Promise<LessonDto[]> {
    if (q.to < q.from) throw new BadRequestException('Período inválido');
    if (addDays(q.from, 62) < q.to) throw new BadRequestException('Período muito longo (máx. 62 dias)');
    const tz = await this.tz(teacherId);
    const qb = this.lessons
      .createQueryBuilder('l')
      .innerJoinAndSelect('l.student', 's')
      .where('l.teacherId = :teacherId', { teacherId })
      .andWhere('l.startsAt >= :from AND l.startsAt < :to', {
        from: zonedToUtc(q.from, '00:00', tz),
        to: zonedToUtc(addDays(q.to, 1), '00:00', tz),
      })
      .orderBy('l.startsAt', 'ASC');
    if (q.studentId) qb.andWhere('l.studentId = :sid', { sid: q.studentId });
    return (await qb.getMany()).map(toLessonDto);
  }

  /** Aulas que já terminaram e ainda estão como "agendada". */
  async pending(teacherId: string): Promise<LessonDto[]> {
    const rows = await this.lessons
      .createQueryBuilder('l')
      .innerJoinAndSelect('l.student', 's')
      .where('l.teacherId = :teacherId AND l.status = :st', { teacherId, st: LessonStatus.AGENDADA })
      .andWhere('l.endsAt < now() AND l.endsAt > :since', { since: new Date(Date.now() - PENDING_WINDOW_DAYS * 86_400_000) })
      .orderBy('l.startsAt', 'ASC')
      .getMany();
    return rows.map(toLessonDto);
  }

  async get(teacherId: string, id: string): Promise<LessonDto> {
    return toLessonDto(await this.owned(teacherId, id));
  }

  async create(teacherId: string, dto: CreateLessonDto): Promise<LessonDto> {
    const student = await this.students.findOne({ where: { id: dto.studentId, teacherId } });
    if (!student) throw new NotFoundException('Aluno não encontrado');
    if (student.status === StudentStatus.INATIVO) throw new BadRequestException('Reative o aluno para agendar');
    const startsAt = new Date(dto.startsAt);

    const id = await this.db.transaction(async (em) => {
      let credit: MakeupCredit | null = null;
      if (dto.makeupCreditId) {
        credit = await em.findOne(MakeupCredit, {
          where: { id: dto.makeupCreditId, teacherId, studentId: student.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!credit || credit.status !== MakeupCreditStatus.ABERTO) {
          throw new BadRequestException('Essa reposição já foi usada');
        }
      }
      const lesson = await em.save(
        em.create(Lesson, {
          teacherId,
          studentId: student.id,
          slotId: null,
          occurrenceDate: null,
          startsAt,
          endsAt: new Date(startsAt.getTime() + dto.durationMin * 60_000),
          status: LessonStatus.AGENDADA,
          mode: dto.mode,
          location: dto.location ?? null,
          meetingUrl: dto.meetingUrl ?? null,
          // Reposição não é cobrada de novo.
          chargeable: !credit,
          makeupCreditId: credit?.id ?? null,
        }),
      );
      if (credit) {
        credit.status = MakeupCreditStatus.USADO;
        credit.usedLessonId = lesson.id;
        await em.save(credit);
      }
      return lesson.id;
    });
    return this.get(teacherId, id);
  }

  async update(teacherId: string, id: string, dto: UpdateLessonDto): Promise<LessonDto> {
    const lesson = await this.owned(teacherId, id);
    const { durationMin, ...rest } = dto;
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) Object.assign(lesson, { [k]: v });
    if (durationMin) lesson.endsAt = new Date(lesson.startsAt.getTime() + durationMin * 60_000);
    await this.lessons.save(lesson);
    return this.get(teacherId, id);
  }

  /**
   * Marca presença/falta. Aplica a regra padrão de cobrança e reposição
   * (o professor pode sobrescrever). Voltar para "agendada" desfaz tudo.
   */
  async attendance(teacherId: string, id: string, dto: AttendanceDto): Promise<LessonDto> {
    await this.db.transaction(async (em) => {
      const lesson = await em.findOne(Lesson, { where: { id, teacherId }, lock: { mode: 'pessimistic_write' } });
      if (!lesson) throw new NotFoundException('Aula não encontrada');
      if (lesson.status === LessonStatus.REMARCADA) {
        throw new BadRequestException('Esta aula foi remarcada — marque a nova data');
      }

      const justified = dto.status === LessonStatus.FALTA_ALUNO ? !!dto.justified : false;
      const defaults = attendanceDefaults(dto.status, justified);
      const isMakeupLesson = !!lesson.makeupCreditId;
      const chargeable = isMakeupLesson ? false : (dto.chargeable ?? defaults.chargeable);
      const wantsMakeup = dto.createMakeup ?? defaults.makeup;

      lesson.status = dto.status;
      lesson.justified = justified;
      lesson.absenceReason = dto.status === LessonStatus.AGENDADA || dto.status === LessonStatus.REALIZADA ? null : (dto.reason ?? null);
      lesson.chargeable = dto.status === LessonStatus.AGENDADA ? !isMakeupLesson : chargeable;
      lesson.markedAt = dto.status === LessonStatus.AGENDADA ? null : new Date();
      lesson.priceCents = lesson.chargeable && dto.status !== LessonStatus.AGENDADA
        ? await this.lessonPrice(em, lesson)
        : null;
      if (dto.status !== LessonStatus.CANCELADA) lesson.blockId = null;
      await em.save(lesson);

      await this.syncCredit(em, lesson, wantsMakeup && dto.status !== LessonStatus.AGENDADA, dto.reason ?? null);

      // Reposição cancelada devolve o crédito.
      if (isMakeupLesson && dto.status === LessonStatus.CANCELADA) {
        await em.update(
          MakeupCredit,
          { id: lesson.makeupCreditId!, usedLessonId: lesson.id },
          { status: MakeupCreditStatus.ABERTO, usedLessonId: null },
        );
        lesson.makeupCreditId = null;
        await em.save(lesson);
      }
    });
    await this.events.emitAsync(Events.LESSON_MARKED, { teacherId, lessonId: id } satisfies LessonMarkedEvent);
    return this.get(teacherId, id);
  }

  /** Remarca: a original vira "remarcada" (histórico) e nasce a aula nova. */
  async reschedule(teacherId: string, id: string, dto: RescheduleDto): Promise<LessonDto> {
    const newId = await this.db.transaction(async (em) => {
      const lesson = await em.findOne(Lesson, { where: { id, teacherId }, lock: { mode: 'pessimistic_write' } });
      if (!lesson) throw new NotFoundException('Aula não encontrada');
      if (lesson.status !== LessonStatus.AGENDADA) throw new BadRequestException('Só dá para remarcar aula agendada');
      const duration = dto.durationMin ?? Math.round((lesson.endsAt.getTime() - lesson.startsAt.getTime()) / 60_000);
      const startsAt = new Date(dto.startsAt);

      lesson.status = LessonStatus.REMARCADA;
      lesson.chargeable = false;
      lesson.markedAt = new Date();
      const creditId = lesson.makeupCreditId;
      lesson.makeupCreditId = null;
      await em.save(lesson);

      const moved = await em.save(
        em.create(Lesson, {
          teacherId,
          studentId: lesson.studentId,
          slotId: null,
          occurrenceDate: null,
          startsAt,
          endsAt: new Date(startsAt.getTime() + duration * 60_000),
          status: LessonStatus.AGENDADA,
          mode: lesson.mode,
          location: lesson.location,
          meetingUrl: lesson.meetingUrl,
          chargeable: !creditId,
          makeupCreditId: creditId,
          rescheduledFromId: lesson.id,
        }),
      );
      if (creditId) await em.update(MakeupCredit, { id: creditId }, { usedLessonId: moved.id });
      return moved.id;
    });
    return this.get(teacherId, newId);
  }

  /** Apaga aula avulsa ainda não marcada. Aulas de horário fixo se cancelam (para não voltarem). */
  async remove(teacherId: string, id: string): Promise<void> {
    const lesson = await this.owned(teacherId, id);
    if (lesson.slotId) throw new BadRequestException('Aulas de horário fixo são canceladas, não apagadas');
    if (lesson.status !== LessonStatus.AGENDADA) throw new BadRequestException('Só dá para apagar aula ainda não marcada');
    await this.db.transaction(async (em) => {
      if (lesson.makeupCreditId) {
        await em.update(MakeupCredit, { id: lesson.makeupCreditId }, { status: MakeupCreditStatus.ABERTO, usedLessonId: null });
      }
      await em.delete(Lesson, { id });
    });
  }

  async listMakeups(teacherId: string, q: ListMakeupQueryDto): Promise<MakeupCreditDto[]> {
    const where = { teacherId, ...(q.studentId ? { studentId: q.studentId } : {}), ...(q.status ? { status: q.status as MakeupCreditStatus } : {}) };
    const credits = await this.credits.find({ where, relations: { student: true }, order: { createdAt: 'DESC' }, take: 200 });
    const originIds = credits.map((c) => c.originLessonId).filter((x): x is string => !!x);
    const origins = originIds.length ? await this.lessons.find({ where: { id: In(originIds) } }) : [];
    const byId = new Map(origins.map((o) => [o.id, o]));
    return credits.map((c) => toMakeupDto(c, c.originLessonId ? byId.get(c.originLessonId) : null));
  }

  async cancelMakeup(teacherId: string, id: string): Promise<void> {
    const credit = await this.credits.findOne({ where: { id, teacherId } });
    if (!credit) throw new NotFoundException('Reposição não encontrada');
    if (credit.status !== MakeupCreditStatus.ABERTO) throw new BadRequestException('Essa reposição já foi usada');
    credit.status = MakeupCreditStatus.CANCELADO;
    await this.credits.save(credit);
  }

  private async syncCredit(em: EntityManager, lesson: Lesson, wanted: boolean, reason: string | null) {
    const existing = await em.findOne(MakeupCredit, { where: { originLessonId: lesson.id } });
    if (wanted) {
      if (!existing) {
        await em.save(
          em.create(MakeupCredit, {
            teacherId: lesson.teacherId,
            studentId: lesson.studentId,
            originLessonId: lesson.id,
            reason,
            status: MakeupCreditStatus.ABERTO,
          }),
        );
      } else if (existing.status === MakeupCreditStatus.CANCELADO) {
        existing.status = MakeupCreditStatus.ABERTO;
        existing.reason = reason;
        await em.save(existing);
      }
    } else if (existing && existing.status === MakeupCreditStatus.ABERTO) {
      existing.status = MakeupCreditStatus.CANCELADO;
      await em.save(existing);
    }
  }

  /** Preço da aula no plano vigente no dia (só planos por aula e pacote). */
  private async lessonPrice(em: EntityManager, lesson: Lesson): Promise<number | null> {
    const tz = await this.tz(lesson.teacherId);
    const day = zonedParts(lesson.startsAt, tz).date;
    const plans = await em.find(BillingPlan, { where: { studentId: lesson.studentId } });
    const plan = planAt(plans, day);
    if (!plan) return null;
    if (plan.type === BillingPlanType.POR_AULA) return plan.lessonPriceCents;
    if (plan.type === BillingPlanType.PACOTE && plan.packageLessons) {
      return Math.round((plan.packagePriceCents ?? 0) / plan.packageLessons);
    }
    return null;
  }

  private async owned(teacherId: string, id: string) {
    const lesson = await this.lessons.findOne({ where: { id, teacherId }, relations: { student: true } });
    if (!lesson) throw new NotFoundException('Aula não encontrada');
    return lesson;
  }

  private async tz(teacherId: string) {
    return (await this.teachers.findById(teacherId)).timezone;
  }
}
