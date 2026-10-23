import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import {
  addDays,
  addMonths,
  BillingPlanType,
  ChargeKind,
  dayOfMonth,
  firstDayOf,
  LessonStatus,
  monthLabel,
  monthOf,
  planAt,
  resolvePlans,
  StudentStatus,
  todayIn,
  zonedParts,
  zonedToUtc,
} from '@aulinha/contracts';
import { BillingPlan } from '../alunos/entities/billing-plan.entity';
import { Student } from '../alunos/entities/student.entity';
import { Lesson } from '../agenda/entities/lesson.entity';
import { Events, type LessonMarkedEvent, type PackageLowEvent, type PlanChangedEvent } from '../common/events';
import { TeachersService } from '../professor/teachers.service';
import { Charge } from './entities/charge.entity';
import { Payment } from './entities/payment.entity';

/** Mensalidades aparecem com esta antecedência do vencimento (para o lembrete D-1 existir). */
const LEAD_DAYS = 7;
const FRESH_MS = 5 * 60_000;
const CHARGED_STATUSES = [LessonStatus.REALIZADA, LessonStatus.FALTA_ALUNO];

/**
 * Gera as cobranças a partir dos planos:
 * - Mensal: uma mensalidade por mês, no dia do vencimento.
 * - Por aula: no fim do mês, soma as aulas cobráveis (vence no dia escolhido do mês seguinte).
 * - Pacote: cobra o pacote ao começar; cada aula consome uma; acabou → novo pacote.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly lastRun = new Map<string, number>();

  constructor(
    @InjectRepository(Charge) private readonly charges: Repository<Charge>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(BillingPlan) private readonly plans: Repository<BillingPlan>,
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    private readonly teachers: TeachersService,
    private readonly db: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  /** Roda a geração no máximo a cada 5 min por professor (chamado ao abrir o financeiro). */
  async ensureFresh(teacherId: string) {
    const last = this.lastRun.get(teacherId) ?? 0;
    if (Date.now() - last < FRESH_MS) return;
    this.lastRun.set(teacherId, Date.now());
    await this.generate(teacherId);
  }

  @Cron('0 4 * * *')
  async generateAll() {
    for (const t of await this.teachers.findAll()) {
      const n = await this.generate(t.id);
      if (n) this.logger.log(`${n} cobrança(s) geradas para ${t.email}`);
    }
  }

  async generate(teacherId: string, studentIds?: string[]): Promise<number> {
    const teacher = await this.teachers.findById(teacherId);
    const tz = teacher.timezone;
    const today = todayIn(tz);
    const students = await this.students.find({
      where: { teacherId, status: Not(StudentStatus.INATIVO), ...(studentIds ? { id: In(studentIds) } : {}) },
    });
    if (!students.length) return 0;
    const plans = await this.plans.find({
      where: { studentId: In(students.map((s) => s.id)) },
      order: { validFrom: 'ASC' },
    });
    let created = 0;
    for (const st of students) {
      const own = plans.filter((p) => p.studentId === st.id);
      for (const plan of own) {
        if (plan.type === BillingPlanType.MENSAL) created += await this.monthly(st, plan, today, tz);
        if (plan.type === BillingPlanType.PACOTE) created += await this.firstPackage(st, plan, today);
      }
      if (own.some((p) => p.type === BillingPlanType.POR_AULA)) {
        created += await this.closePastMonths(st, own, today, tz);
      }
    }
    return created;
  }

  private async monthly(st: Student, plan: BillingPlan, today: string, tz: string): Promise<number> {
    if (!plan.monthlyFeeCents || !plan.dueDay) return 0;
    // Não gera retroativo para antes do cadastro do plano no app.
    const createdMonth = monthOf(zonedParts(plan.createdAt, tz).date);
    let m = monthOf(plan.validFrom) > createdMonth ? monthOf(plan.validFrom) : createdMonth;
    const rows: Partial<Charge>[] = [];
    for (let guard = 0; guard < 36; guard++, m = addMonths(m, 1)) {
      if (plan.validTo && firstDayOf(m) > plan.validTo) break;
      let due = dayOfMonth(m, plan.dueDay);
      if (m === monthOf(plan.validFrom) && due < plan.validFrom) due = plan.validFrom;
      if (due > addDays(today, LEAD_DAYS)) break;
      if (st.status === StudentStatus.PAUSADO && (!st.pausedUntil || due <= st.pausedUntil)) continue;
      rows.push({
        teacherId: st.teacherId,
        studentId: st.id,
        kind: ChargeKind.MENSALIDADE,
        referenceMonth: m,
        description: `Mensalidade de ${monthLabel(m, false)}`,
        amountCents: plan.monthlyFeeCents,
        discountCents: 0,
        dueDate: due,
        planId: plan.id,
      });
    }
    if (!rows.length) return 0;
    const res = await this.charges.createQueryBuilder().insert().into(Charge).values(rows).orIgnore().execute();
    return res.identifiers.filter(Boolean).length;
  }

  private async firstPackage(st: Student, plan: BillingPlan, today: string): Promise<number> {
    if (!plan.packageLessons || !plan.packagePriceCents) return 0;
    const current = resolvePlans([plan], today).current;
    if (!current) return 0;
    const exists = await this.charges.count({ where: { planId: plan.id, kind: ChargeKind.PACOTE } });
    if (exists) return 0;
    await this.charges.save(
      this.charges.create({
        teacherId: st.teacherId,
        studentId: st.id,
        kind: ChargeKind.PACOTE,
        referenceMonth: monthOf(plan.validFrom),
        description: `Pacote de ${plan.packageLessons} aulas`,
        amountCents: plan.packagePriceCents,
        discountCents: 0,
        dueDate: plan.validFrom > today ? plan.validFrom : today,
        planId: plan.id,
        packageLessons: plan.packageLessons,
      }),
    );
    return 1;
  }

  /** Fecha automaticamente os meses passados dos planos por aula. */
  private async closePastMonths(st: Student, plans: BillingPlan[], today: string, tz: string): Promise<number> {
    const before = zonedToUtc(firstDayOf(monthOf(today)), '00:00', tz);
    const pending = await this.lessons
      .createQueryBuilder('l')
      .where('l.studentId = :sid AND l.chargeId IS NULL AND l.chargeable = true', { sid: st.id })
      .andWhere('l.status IN (:...st)', { st: CHARGED_STATUSES })
      .andWhere('l.priceCents IS NOT NULL AND l.startsAt < :before', { before })
      .getMany();
    const byMonth = new Map<string, Lesson[]>();
    for (const l of pending) {
      const day = zonedParts(l.startsAt, tz).date;
      if (planAt(plans, day)?.type !== BillingPlanType.POR_AULA) continue;
      const m = monthOf(day);
      byMonth.set(m, [...(byMonth.get(m) ?? []), l]);
    }
    let created = 0;
    for (const [m, list] of byMonth) {
      created += await this.db.transaction((em) => this.attachToMonth(em, st, m, list, plans));
    }
    return created;
  }

  /** "Fechar mês agora": também vale para o mês corrente. */
  async closeMonth(teacherId: string, studentId: string, month: string): Promise<number> {
    const st = await this.students.findOne({ where: { id: studentId, teacherId } });
    if (!st) throw new NotFoundException('Aluno não encontrado');
    const tz = (await this.teachers.findById(teacherId)).timezone;
    const plans = await this.plans.find({ where: { studentId } });
    const list = await this.lessons
      .createQueryBuilder('l')
      .where('l.studentId = :sid AND l.chargeId IS NULL AND l.chargeable = true', { sid: studentId })
      .andWhere('l.status IN (:...st)', { st: CHARGED_STATUSES })
      .andWhere('l.priceCents IS NOT NULL')
      .andWhere('l.startsAt >= :from AND l.startsAt < :to', {
        from: zonedToUtc(firstDayOf(month), '00:00', tz),
        to: zonedToUtc(firstDayOf(addMonths(month, 1)), '00:00', tz),
      })
      .getMany();
    if (!list.length) throw new BadRequestException('Nenhuma aula a cobrar nesse mês');
    return this.db.transaction((em) => this.attachToMonth(em, st, month, list, plans));
  }

  /** Prévia do mês corrente para planos por aula. */
  async preview(teacherId: string, studentId: string, month: string) {
    const tz = (await this.teachers.findById(teacherId)).timezone;
    const rows = await this.lessons
      .createQueryBuilder('l')
      .where('l.teacherId = :teacherId AND l.studentId = :sid AND l.chargeId IS NULL AND l.chargeable = true', {
        teacherId,
        sid: studentId,
      })
      .andWhere('l.status IN (:...st)', { st: CHARGED_STATUSES })
      .andWhere('l.priceCents IS NOT NULL')
      .andWhere('l.startsAt >= :from AND l.startsAt < :to', {
        from: zonedToUtc(firstDayOf(month), '00:00', tz),
        to: zonedToUtc(firstDayOf(addMonths(month, 1)), '00:00', tz),
      })
      .getMany();
    return { month, lessonsCount: rows.length, amountCents: rows.reduce((s, l) => s + (l.priceCents ?? 0), 0) };
  }

  private async attachToMonth(em: EntityManager, st: Student, m: string, list: Lesson[], plans: BillingPlan[]): Promise<number> {
    const plan = planAt(plans, `${m}-28`) ?? plans[plans.length - 1];
    const amount = list.reduce((s, l) => s + (l.priceCents ?? 0), 0);
    const existing = await em.findOne(Charge, {
      where: { studentId: st.id, kind: ChargeKind.AULAS_DO_MES, referenceMonth: m },
      lock: { mode: 'pessimistic_write' },
    });
    let target: Charge;
    let created = 0;
    if (existing && !existing.canceledAt) {
      const paid = (await em.find(Payment, { where: { chargeId: existing.id } })).reduce((s, p) => s + p.amountCents, 0);
      if (paid < existing.amountCents - existing.discountCents) {
        existing.amountCents += amount;
        target = await em.save(existing);
      } else {
        target = await em.save(
          em.create(Charge, {
            teacherId: st.teacherId,
            studentId: st.id,
            kind: ChargeKind.AJUSTE,
            referenceMonth: m,
            description: `Aulas adicionais de ${monthLabel(m, false)}`,
            amountCents: amount,
            discountCents: 0,
            dueDate: dayOfMonth(addMonths(m, 1), plan?.dueDay ?? 10),
            planId: plan?.id ?? null,
          }),
        );
        created = 1;
      }
    } else {
      if (existing) await em.remove(existing);
      target = await em.save(
        em.create(Charge, {
          teacherId: st.teacherId,
          studentId: st.id,
          kind: ChargeKind.AULAS_DO_MES,
          referenceMonth: m,
          description: `Aulas de ${monthLabel(m, false)}`,
          amountCents: amount,
          discountCents: 0,
          dueDate: dayOfMonth(addMonths(m, 1), plan?.dueDay ?? 10),
          planId: plan?.id ?? null,
        }),
      );
      created = 1;
    }
    await em.update(Lesson, { id: In(list.map((l) => l.id)) }, { chargeId: target.id });
    return created;
  }

  /** Pacotes: cada aula cobrável consome uma aula do pacote aberto. */
  @OnEvent(Events.LESSON_MARKED, { async: true, promisify: true })
  async onLessonMarked(e: LessonMarkedEvent) {
    const lesson = await this.lessons.findOne({ where: { id: e.lessonId } });
    if (!lesson) return;
    const counts = lesson.chargeable && CHARGED_STATUSES.includes(lesson.status as (typeof CHARGED_STATUSES)[number]);

    if (!counts) {
      if (lesson.chargeId) {
        const c = await this.charges.findOne({ where: { id: lesson.chargeId } });
        // Só desvincula de pacote (fechamentos mensais já emitidos ficam como estão).
        if (c?.kind === ChargeKind.PACOTE) await this.lessons.update(lesson.id, { chargeId: null });
      }
      return;
    }
    if (lesson.chargeId) return;

    const tz = (await this.teachers.findById(e.teacherId)).timezone;
    const day = zonedParts(lesson.startsAt, tz).date;
    const plans = await this.plans.find({ where: { studentId: lesson.studentId } });
    const plan = planAt(plans, day);
    if (plan?.type !== BillingPlanType.PACOTE || !plan.packageLessons) return;

    let lowPackage: PackageLowEvent | null = null;
    await this.db.transaction(async (em) => {
      const open = await em.find(Charge, {
        where: { studentId: lesson.studentId, kind: ChargeKind.PACOTE, canceledAt: IsNull() },
        order: { createdAt: 'ASC' },
      });
      for (const c of open) {
        const used = await em.count(Lesson, { where: { chargeId: c.id } });
        if (used < (c.packageLessons ?? 0)) {
          await em.update(Lesson, lesson.id, { chargeId: c.id });
          const remaining = (c.packageLessons ?? 0) - used - 1;
          if (remaining <= 1) {
            lowPackage = { teacherId: e.teacherId, studentId: lesson.studentId, chargeId: c.id, remaining };
          }
          return;
        }
      }
      const renewal = await em.save(
        em.create(Charge, {
          teacherId: lesson.teacherId,
          studentId: lesson.studentId,
          kind: ChargeKind.PACOTE,
          referenceMonth: monthOf(day),
          description: `Pacote de ${plan.packageLessons} aulas${open.length ? ' (renovação)' : ''}`,
          amountCents: plan.packagePriceCents ?? 0,
          discountCents: 0,
          dueDate: todayIn(tz),
          planId: plan.id,
          packageLessons: plan.packageLessons,
        }),
      );
      await em.update(Lesson, lesson.id, { chargeId: renewal.id });
    });
    if (lowPackage) this.events.emit(Events.PACKAGE_LOW, lowPackage);
  }

  @OnEvent(Events.PLAN_CHANGED, { async: true, promisify: true })
  async onPlanChanged(e: PlanChangedEvent) {
    this.lastRun.delete(e.teacherId);
    await this.generate(e.teacherId, [e.studentId]);
  }
}
