import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  addDays,
  addMonths,
  ChargeStatus,
  LESSON_STATUS_LABEL,
  latenessScore,
  LessonStatus,
  monthOf,
  PAYMENT_METHOD_LABEL,
  payerBadge,
  planAt,
  SavedFilterScope,
  todayIn,
  zonedParts,
  zonedToUtc,
  type AttendanceRowDto,
  type ChargeDto,
  type LatePayerDto,
  type PaymentMethod,
  type ReportSummaryDto,
  type SavedFilterDto,
} from '@aulinha/contracts';
import { BillingPlan } from '../alunos/entities/billing-plan.entity';
import { Student } from '../alunos/entities/student.entity';
import { Lesson } from '../agenda/entities/lesson.entity';
import { toStudentRef } from '../common/utils/student-ref';
import { toChargeDto } from '../financeiro/charge-mapper';
import { Charge } from '../financeiro/entities/charge.entity';
import { Payment } from '../financeiro/entities/payment.entity';
import { TeachersService } from '../professor/teachers.service';
import { ReportQueryDto, SaveFilterDto } from './dto/reports.dto';
import { SavedFilter } from './entities/saved-filter.entity';

const BADGE_LABEL = { EM_DIA: 'Em dia', AS_VEZES: 'Às vezes atrasa', SEMPRE: 'Atrasa sempre' };

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(BillingPlan) private readonly plans: Repository<BillingPlan>,
    @InjectRepository(Charge) private readonly charges: Repository<Charge>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    @InjectRepository(SavedFilter) private readonly filters: Repository<SavedFilter>,
    private readonly teachers: TeachersService,
  ) {}

  // ---------- filtros ----------

  /** Alunos que passam nos filtros de aluno/etiqueta/tipo de plano. */
  private async eligible(teacherId: string, q: ReportQueryDto): Promise<Map<string, Student>> {
    if (q.to < q.from) throw new BadRequestException('Período inválido');
    if (addDays(q.from, 740) < q.to) throw new BadRequestException('Período muito longo (máx. 2 anos)');
    const all = await this.students.find({ where: { teacherId, ...(q.studentIds?.length ? { id: In(q.studentIds) } : {}) } });
    let list = q.tags?.length ? all.filter((s) => s.tags.some((t) => q.tags!.includes(t))) : all;
    if (q.planTypes?.length && list.length) {
      const plans = await this.plans.find({ where: { studentId: In(list.map((s) => s.id)) } });
      list = list.filter((s) => {
        const p = planAt(plans.filter((x) => x.studentId === s.id), q.to);
        return !!p && q.planTypes!.includes(p.type);
      });
    }
    return new Map(list.map((s) => [s.id, s]));
  }

  private async chargesIn(teacherId: string, ids: string[], q: ReportQueryDto, today: string): Promise<ChargeDto[]> {
    if (!ids.length) return [];
    const rows = await this.charges.find({
      where: { teacherId, studentId: In(ids) },
      relations: { student: true, payments: true },
    });
    return rows
      .filter((c) => c.dueDate >= q.from && c.dueDate <= q.to)
      .map((c) => toChargeDto(c, today))
      .filter((c) => c.status !== ChargeStatus.CANCELADO);
  }

  private async paymentsIn(teacherId: string, ids: string[], q: ReportQueryDto) {
    if (!ids.length) return [];
    const qb = this.payments
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.charge', 'c')
      .innerJoinAndSelect('c.student', 's')
      .where('p.teacherId = :teacherId', { teacherId })
      .andWhere('c.studentId IN (:...ids)', { ids })
      .andWhere('p.paidAt BETWEEN :from AND :to', { from: q.from, to: q.to })
      .orderBy('p.paidAt', 'ASC');
    if (q.methods?.length) qb.andWhere('p.method IN (:...methods)', { methods: q.methods });
    return qb.getMany();
  }

  private async lessonsIn(teacherId: string, ids: string[], q: ReportQueryDto, tz: string) {
    if (!ids.length) return [];
    return this.lessons
      .createQueryBuilder('l')
      .innerJoinAndSelect('l.student', 's')
      .where('l.teacherId = :teacherId AND l.studentId IN (:...ids)', { teacherId, ids })
      .andWhere('l.startsAt >= :from AND l.startsAt < :to', {
        from: zonedToUtc(q.from, '00:00', tz),
        to: zonedToUtc(addDays(q.to, 1), '00:00', tz),
      })
      .orderBy('l.startsAt', 'ASC')
      .getMany();
  }

  private async ctx(teacherId: string) {
    const t = await this.teachers.findById(teacherId);
    return { tz: t.timezone, today: todayIn(t.timezone) };
  }

  // ---------- relatórios ----------

  async summary(teacherId: string, q: ReportQueryDto): Promise<ReportSummaryDto> {
    const { tz, today } = await this.ctx(teacherId);
    const students = await this.eligible(teacherId, q);
    const ids = [...students.keys()];
    const [charges, payments, lessons] = await Promise.all([
      this.chargesIn(teacherId, ids, q, today),
      this.paymentsIn(teacherId, ids, q),
      this.lessonsIn(teacherId, ids, q, tz),
    ]);
    const filteredCharges = q.onlyLate ? charges.filter((c) => c.daysLate > 0) : charges;

    const months: string[] = [];
    for (let m = monthOf(q.from); m <= monthOf(q.to) && months.length < 25; m = addMonths(m, 1)) months.push(m);
    const byMonth = months.map((month) => ({
      month,
      receivedCents: payments.filter((p) => monthOf(p.paidAt) === month).reduce((s, p) => s + p.amountCents, 0),
      expectedCents: filteredCharges.filter((c) => monthOf(c.dueDate) === month).reduce((s, c) => s + c.netCents, 0),
    }));

    const methodMap = new Map<PaymentMethod, { cents: number; count: number }>();
    for (const p of payments) {
      const cur = methodMap.get(p.method) ?? { cents: 0, count: 0 };
      methodMap.set(p.method, { cents: cur.cents + p.amountCents, count: cur.count + 1 });
    }

    const studentMap = new Map<string, { receivedCents: number; openCents: number }>();
    for (const p of payments) {
      const cur = studentMap.get(p.charge.studentId) ?? { receivedCents: 0, openCents: 0 };
      cur.receivedCents += p.amountCents;
      studentMap.set(p.charge.studentId, cur);
    }
    for (const c of filteredCharges) {
      const cur = studentMap.get(c.student.id) ?? { receivedCents: 0, openCents: 0 };
      cur.openCents += c.balanceCents;
      studentMap.set(c.student.id, cur);
    }

    const received = payments.reduce((s, p) => s + p.amountCents, 0);
    const count = (st: LessonStatus) => lessons.filter((l) => l.status === st).length;
    return {
      receivedCents: received,
      expectedCents: filteredCharges.reduce((s, c) => s + c.netCents, 0),
      openCents: filteredCharges.reduce((s, c) => s + c.balanceCents, 0),
      overdueCents: filteredCharges.filter((c) => c.status === ChargeStatus.ATRASADO).reduce((s, c) => s + c.balanceCents, 0),
      paymentsCount: payments.length,
      averageTicketCents: payments.length ? Math.round(received / payments.length) : 0,
      lessons: {
        realized: count(LessonStatus.REALIZADA),
        studentAbsences: count(LessonStatus.FALTA_ALUNO),
        teacherAbsences: count(LessonStatus.FALTA_PROFESSOR),
        canceled: count(LessonStatus.CANCELADA),
      },
      byMonth,
      byMethod: [...methodMap.entries()].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.cents - a.cents),
      byStudent: [...studentMap.entries()]
        .filter(([id]) => students.has(id))
        .map(([id, v]) => ({ student: toStudentRef(students.get(id)!), ...v }))
        .sort((a, b) => b.receivedCents - a.receivedCents),
    };
  }

  /** Quem mais atrasa: frequência e intensidade dos atrasos no período + o que está em aberto hoje. */
  async latePayers(teacherId: string, q: ReportQueryDto): Promise<LatePayerDto[]> {
    const { today } = await this.ctx(teacherId);
    const students = await this.eligible(teacherId, q);
    const charges = await this.chargesIn(teacherId, [...students.keys()], q, today);
    const by = new Map<string, ChargeDto[]>();
    for (const c of charges) by.set(c.student.id, [...(by.get(c.student.id) ?? []), c]);

    const rows: LatePayerDto[] = [];
    for (const [id, list] of by) {
      // Só conta o que já venceu (cobrança futura ainda não teve chance de atrasar).
      const due = list.filter((c) => c.dueDate < today || c.status === ChargeStatus.PAGO);
      if (!due.length) continue;
      const late = due.filter((c) => c.daysLate > 0);
      const overdue = list.filter((c) => c.status === ChargeStatus.ATRASADO);
      const latePct = Math.round((late.length / due.length) * 100);
      const avg = late.length ? late.reduce((s, c) => s + c.daysLate, 0) / late.length : 0;
      const score = latenessScore(latePct, avg, overdue.length > 0);
      rows.push({
        student: toStudentRef(students.get(id)!),
        chargesCount: due.length,
        lateCount: late.length,
        latePct,
        avgDaysLate: Math.round(avg * 10) / 10,
        maxDaysLate: Math.max(0, ...late.map((c) => c.daysLate)),
        overdueCents: overdue.reduce((s, c) => s + c.balanceCents, 0),
        overdueCount: overdue.length,
        score,
        badge: payerBadge(score),
      });
    }
    return rows
      .filter((r) => !q.onlyLate || r.lateCount > 0)
      .sort((a, b) => b.score - a.score || b.overdueCents - a.overdueCents || a.student.name.localeCompare(b.student.name));
  }

  async attendance(teacherId: string, q: ReportQueryDto): Promise<AttendanceRowDto[]> {
    const { tz } = await this.ctx(teacherId);
    const students = await this.eligible(teacherId, q);
    const lessons = (await this.lessonsIn(teacherId, [...students.keys()], q, tz)).filter(
      (l) => l.status !== LessonStatus.REMARCADA && l.status !== LessonStatus.AGENDADA,
    );
    const by = new Map<string, Lesson[]>();
    for (const l of lessons) by.set(l.studentId, [...(by.get(l.studentId) ?? []), l]);
    return [...by.entries()]
      .map(([id, list]) => {
        const realized = list.filter((l) => l.status === LessonStatus.REALIZADA).length;
        const absences = list.filter((l) => l.status === LessonStatus.FALTA_ALUNO);
        return {
          student: toStudentRef(students.get(id)!),
          total: list.length,
          realized,
          studentAbsences: absences.length,
          justifiedAbsences: absences.filter((l) => l.justified).length,
          teacherAbsences: list.filter((l) => l.status === LessonStatus.FALTA_PROFESSOR).length,
          canceled: list.filter((l) => l.status === LessonStatus.CANCELADA).length,
          rate: realized + absences.length ? Math.round((realized / (realized + absences.length)) * 100) : 100,
        };
      })
      .sort((a, b) => a.rate - b.rate || b.studentAbsences - a.studentAbsences);
  }

  // ---------- CSV ----------

  async csv(teacherId: string, type: string, q: ReportQueryDto): Promise<{ filename: string; body: string }> {
    const { tz, today } = await this.ctx(teacherId);
    const students = await this.eligible(teacherId, q);
    const ids = [...students.keys()];
    const money = (c: number) => (c / 100).toFixed(2).replace('.', ',');
    const date = (d: string) => d.split('-').reverse().join('/');
    let header: string[] = [];
    let rows: (string | number)[][] = [];

    if (type === 'pagamentos') {
      header = ['Data', 'Aluno', 'Descrição', 'Forma', 'Valor (R$)', 'Recibo', 'Observação'];
      rows = (await this.paymentsIn(teacherId, ids, q)).map((p) => [
        date(p.paidAt),
        p.charge.student.name,
        p.charge.description,
        PAYMENT_METHOD_LABEL[p.method],
        money(p.amountCents),
        p.receiptNumber,
        p.note ?? '',
      ]);
    } else if (type === 'cobrancas') {
      header = ['Vencimento', 'Aluno', 'Descrição', 'Valor', 'Desconto', 'Pago', 'Saldo', 'Status', 'Dias de atraso'];
      rows = (await this.chargesIn(teacherId, ids, q, today))
        .filter((c) => !q.onlyLate || c.daysLate > 0)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .map((c) => [date(c.dueDate), c.student.name, c.description, money(c.amountCents), money(c.discountCents), money(c.paidCents), money(c.balanceCents), c.status, c.daysLate]);
    } else if (type === 'aulas') {
      header = ['Data', 'Hora', 'Aluno', 'Situação', 'Justificada', 'Motivo', 'Cobrada', 'Valor da aula', 'Conteúdo'];
      rows = (await this.lessonsIn(teacherId, ids, q, tz)).map((l) => {
        const p = zonedParts(l.startsAt, tz);
        return [date(p.date), p.time, l.student.name, LESSON_STATUS_LABEL[l.status], l.justified ? 'sim' : '', l.absenceReason ?? '', l.chargeable ? 'sim' : 'não', l.priceCents ? money(l.priceCents) : '', l.content ?? ''];
      });
    } else if (type === 'atrasos') {
      header = ['Aluno', 'Cobranças vencidas', 'Pagas com atraso / em atraso', '% com atraso', 'Média de dias', 'Maior atraso', 'Em atraso hoje (R$)', 'Classificação'];
      rows = (await this.latePayers(teacherId, q)).map((r) => [
        r.student.name, r.chargesCount, r.lateCount, r.latePct, String(r.avgDaysLate).replace('.', ','), r.maxDaysLate, money(r.overdueCents), BADGE_LABEL[r.badge],
      ]);
    } else {
      header = ['Aluno', 'Aulas marcadas', 'Realizadas', 'Faltas do aluno', 'Justificadas', 'Faltas do professor', 'Canceladas', 'Presença (%)'];
      rows = (await this.attendance(teacherId, q)).map((r) => [
        r.student.name, r.total, r.realized, r.studentAbsences, r.justifiedAbsences, r.teacherAbsences, r.canceled, r.rate,
      ]);
    }

    const cell = (v: string | number) => {
      let s = String(v);
      // CSV injection: texto que começa com = + - @ vira fórmula no Excel. Prefixa com apóstrofo.
      if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // BOM + ";" abrem certinho no Excel em português.
    const body = '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
    return { filename: `aulinha-${type}-${q.from}-a-${q.to}.csv`, body };
  }

  // ---------- filtros salvos ----------

  async listFilters(teacherId: string): Promise<SavedFilterDto[]> {
    const rows = await this.filters.find({ where: { teacherId }, order: { pinned: 'DESC', createdAt: 'ASC' } });
    return rows.map((f) => this.filterDto(f));
  }

  async saveFilter(teacherId: string, dto: SaveFilterDto): Promise<SavedFilterDto> {
    if ((await this.filters.count({ where: { teacherId } })) >= 30) throw new BadRequestException('Limite de 30 filtros');
    const f = await this.filters.save(
      this.filters.create({ teacherId, scope: SavedFilterScope.RELATORIOS, name: dto.name, period: dto.period, criteria: dto.criteria, pinned: dto.pinned ?? true }),
    );
    return this.filterDto(f);
  }

  async updateFilter(teacherId: string, id: string, dto: Partial<SaveFilterDto>): Promise<SavedFilterDto> {
    const f = await this.filters.findOne({ where: { id, teacherId } });
    if (!f) throw new NotFoundException('Filtro não encontrado');
    Object.assign(f, Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)));
    return this.filterDto(await this.filters.save(f));
  }

  async removeFilter(teacherId: string, id: string) {
    await this.filters.delete({ id, teacherId });
  }

  private filterDto(f: SavedFilter): SavedFilterDto {
    return { id: f.id, name: f.name, scope: f.scope, period: f.period, criteria: f.criteria, pinned: f.pinned, createdAt: f.createdAt.toISOString() };
  }
}
