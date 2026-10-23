import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  addDays,
  ChargeKind,
  ChargeStatus,
  DEFAULT_WHATSAPP_TEMPLATE,
  displayName,
  fillTemplate,
  firstDayOf,
  formatBRL,
  lastDayOf,
  monthOf,
  todayIn,
  whatsappLink,
  type ChargeDto,
  type MonthSummaryDto,
  type ReceiptDto,
  type WhatsappMessageDto,
} from '@aulinha/contracts';
import { Student } from '../alunos/entities/student.entity';
import { Lesson } from '../agenda/entities/lesson.entity';
import { Teacher } from '../professor/entities/teacher.entity';
import { TeachersService } from '../professor/teachers.service';
import { BillingService } from './billing.service';
import { toChargeDto, toPaymentDto } from './charge-mapper';
import {
  CreateChargeDto,
  ListChargesQueryDto,
  RegisterPaymentDto,
  UpdateChargeDto,
} from './dto/finance.dto';
import { Charge } from './entities/charge.entity';
import { Payment } from './entities/payment.entity';

const OPEN: ChargeStatus[] = [ChargeStatus.PENDENTE, ChargeStatus.PARCIAL, ChargeStatus.ATRASADO];

const PIX_LABEL: Record<string, string> = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  EMAIL: 'e-mail',
  TELEFONE: 'celular',
  ALEATORIA: 'chave aleatória',
};

@Injectable()
export class ChargesService {
  constructor(
    @InjectRepository(Charge) private readonly charges: Repository<Charge>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    private readonly teachers: TeachersService,
    private readonly billing: BillingService,
    private readonly db: DataSource,
  ) {}

  async list(teacherId: string, q: ListChargesQueryDto): Promise<ChargeDto[]> {
    await this.billing.ensureFresh(teacherId);
    const today = await this.today(teacherId);
    const qb = this.base(teacherId).orderBy('c.dueDate', 'ASC').addOrderBy('st.name', 'ASC').take(3000);
    if (q.studentId) qb.andWhere('c.studentId = :sid', { sid: q.studentId });
    // "Atrasadas" ignora o mês: mostra tudo que está vencido.
    if (q.month && q.status !== 'atrasadas') {
      qb.andWhere('c.dueDate BETWEEN :from AND :to', { from: firstDayOf(q.month), to: lastDayOf(q.month) });
    }
    if (q.status === 'atrasadas') qb.andWhere('c.dueDate < :today AND c.canceledAt IS NULL', { today });
    const dtos = await this.toDtos(await qb.getMany(), today);
    switch (q.status) {
      case 'abertas':
        return dtos.filter((c) => OPEN.includes(c.status));
      case 'atrasadas':
        return dtos.filter((c) => c.status === ChargeStatus.ATRASADO);
      case 'pagas':
        return dtos.filter((c) => c.status === ChargeStatus.PAGO);
      default:
        return q.studentId ? dtos.reverse() : dtos;
    }
  }

  async get(teacherId: string, id: string): Promise<ChargeDto> {
    const c = await this.base(teacherId).andWhere('c.id = :id', { id }).getOne();
    if (!c) throw new NotFoundException('Cobrança não encontrada');
    return (await this.toDtos([c], await this.today(teacherId)))[0];
  }

  async summary(teacherId: string, month: string): Promise<MonthSummaryDto> {
    await this.billing.ensureFresh(teacherId);
    const today = await this.today(teacherId);
    const monthCharges = await this.toDtos(
      await this.base(teacherId)
        .andWhere('c.dueDate BETWEEN :from AND :to', { from: firstDayOf(month), to: lastDayOf(month) })
        .andWhere('c.canceledAt IS NULL')
        .getMany(),
      today,
    );
    const overdue = await this.toDtos(
      await this.base(teacherId).andWhere('c.dueDate < :today AND c.canceledAt IS NULL', { today }).getMany(),
      today,
    );
    const late = overdue.filter((c) => c.status === ChargeStatus.ATRASADO);
    return {
      month,
      expectedCents: monthCharges.reduce((s, c) => s + c.netCents, 0),
      receivedCents: monthCharges.reduce((s, c) => s + Math.min(c.paidCents, c.netCents), 0),
      openCents: monthCharges.reduce((s, c) => s + c.balanceCents, 0),
      overdueCents: late.reduce((s, c) => s + c.balanceCents, 0),
      chargesCount: monthCharges.length,
      paidCount: monthCharges.filter((c) => c.status === ChargeStatus.PAGO).length,
      overdueCount: late.length,
    };
  }

  /** Para a tela Hoje: vencendo nos próximos 7 dias e atrasadas. */
  async highlights(teacherId: string): Promise<{ dueSoon: ChargeDto[]; overdue: ChargeDto[] }> {
    await this.billing.ensureFresh(teacherId);
    const today = await this.today(teacherId);
    const rows = await this.base(teacherId)
      .andWhere('c.canceledAt IS NULL AND c.dueDate <= :until', { until: addDays(today, 7) })
      .orderBy('c.dueDate', 'ASC')
      .getMany();
    const dtos = await this.toDtos(rows, today);
    return {
      dueSoon: dtos.filter((c) => c.dueDate >= today && OPEN.includes(c.status)),
      overdue: dtos.filter((c) => c.status === ChargeStatus.ATRASADO),
    };
  }

  async create(teacherId: string, dto: CreateChargeDto): Promise<ChargeDto> {
    const student = await this.students.findOne({ where: { id: dto.studentId, teacherId } });
    if (!student) throw new NotFoundException('Aluno não encontrado');
    const c = await this.charges.save(
      this.charges.create({
        teacherId,
        studentId: student.id,
        kind: dto.kind ?? ChargeKind.AVULSA,
        referenceMonth: monthOf(dto.dueDate),
        description: dto.description,
        amountCents: dto.amountCents,
        discountCents: 0,
        dueDate: dto.dueDate,
      }),
    );
    return this.get(teacherId, c.id);
  }

  async update(teacherId: string, id: string, dto: UpdateChargeDto): Promise<ChargeDto> {
    const c = await this.owned(teacherId, id);
    if (c.canceledAt) throw new BadRequestException('Cobrança cancelada — reabra para editar');
    if (dto.description !== undefined) c.description = dto.description;
    if (dto.amountCents !== undefined) c.amountCents = dto.amountCents;
    if (dto.discountCents !== undefined) c.discountCents = dto.discountCents;
    if (dto.dueDate !== undefined) c.dueDate = dto.dueDate;
    if (c.discountCents > c.amountCents) throw new BadRequestException('O desconto é maior que o valor');
    await this.charges.save(c);
    return this.get(teacherId, id);
  }

  async cancel(teacherId: string, id: string): Promise<ChargeDto> {
    const c = await this.owned(teacherId, id);
    const paid = await this.payments.count({ where: { chargeId: id } });
    if (paid) throw new BadRequestException('Estorne os pagamentos antes de cancelar');
    c.canceledAt = new Date();
    await this.charges.save(c);
    // Aulas voltam a ficar disponíveis para um próximo fechamento.
    await this.lessons.update({ chargeId: id }, { chargeId: null });
    return this.get(teacherId, id);
  }

  async reopen(teacherId: string, id: string): Promise<ChargeDto> {
    const c = await this.owned(teacherId, id);
    c.canceledAt = null;
    await this.charges.save(c);
    return this.get(teacherId, id);
  }

  async remove(teacherId: string, id: string): Promise<void> {
    const c = await this.owned(teacherId, id);
    if (c.kind !== ChargeKind.AVULSA && c.kind !== ChargeKind.AJUSTE) {
      throw new BadRequestException('Cobranças automáticas são canceladas, não apagadas');
    }
    if (await this.payments.count({ where: { chargeId: id } })) {
      throw new BadRequestException('Estorne os pagamentos antes de apagar');
    }
    await this.charges.remove(c);
  }

  async registerPayment(teacherId: string, chargeId: string, dto: RegisterPaymentDto): Promise<ChargeDto> {
    await this.db.transaction(async (em) => {
      const c = await em.findOne(Charge, { where: { id: chargeId, teacherId }, lock: { mode: 'pessimistic_write' } });
      if (!c) throw new NotFoundException('Cobrança não encontrada');
      if (c.canceledAt) throw new BadRequestException('Cobrança cancelada');
      const paid = (await em.find(Payment, { where: { chargeId } })).reduce((s, p) => s + p.amountCents, 0);
      const balance = Math.max(0, c.amountCents - c.discountCents) - paid;
      if (balance <= 0) throw new BadRequestException('Essa cobrança já está paga');
      if (dto.amountCents > balance) {
        throw new BadRequestException(`O valor passa do saldo (${formatBRL(balance)})`);
      }
      const count = await em.count(Payment, { where: { teacherId } });
      await em.save(
        em.create(Payment, {
          teacherId,
          chargeId,
          amountCents: dto.amountCents,
          paidAt: dto.paidAt,
          method: dto.method,
          note: dto.note ?? null,
          receiptNumber: String(count + 1).padStart(6, '0'),
        }),
      );
    });
    return this.get(teacherId, chargeId);
  }

  async removePayment(teacherId: string, paymentId: string): Promise<ChargeDto> {
    const p = await this.payments.findOne({ where: { id: paymentId, teacherId } });
    if (!p) throw new NotFoundException('Pagamento não encontrado');
    await this.payments.remove(p);
    return this.get(teacherId, p.chargeId);
  }

  async receipt(teacherId: string, paymentId: string): Promise<ReceiptDto> {
    const p = await this.payments.findOne({ where: { id: paymentId, teacherId } });
    if (!p) throw new NotFoundException('Pagamento não encontrado');
    const charge = await this.get(teacherId, p.chargeId);
    const teacher = await this.teachers.findById(teacherId);
    const student = await this.students.findOneByOrFail({ id: charge.student.id });
    return {
      payment: toPaymentDto(p),
      charge,
      teacherName: teacher.name,
      payerName: student.payerIsGuardian && student.guardianName ? student.guardianName : student.name,
    };
  }

  /** Mensagem pronta para cobrar pelo WhatsApp (o aluno não usa o app). */
  async whatsapp(teacherId: string, id: string): Promise<WhatsappMessageDto> {
    const charge = await this.get(teacherId, id);
    const student = await this.students.findOneByOrFail({ id: charge.student.id });
    const teacher = await this.teachers.findById(teacherId);
    const today = todayIn(teacher.timezone);
    const toGuardian = student.payerIsGuardian && !!student.guardianName;
    const phone = (toGuardian ? student.guardianPhone : student.phone) ?? student.phone ?? student.guardianPhone;
    const recipientName = toGuardian ? student.guardianName! : displayName(student);
    const first = recipientName.split(/\s+/)[0];

    const text = fillTemplate(this.templateFor(teacher, charge, today), {
      nome: first,
      aluno: displayName(student),
      descricao: charge.description.charAt(0).toLowerCase() + charge.description.slice(1),
      valor: formatBRL(charge.balanceCents || charge.netCents),
      vencimento: this.dueLabel(charge.dueDate, today),
      pix: teacher.pixKey ? `\nPIX (${PIX_LABEL[teacher.pixKeyType ?? ''] ?? 'chave'}): ${teacher.pixKey}` : '',
      professor: teacher.name.split(/\s+/)[0],
    });
    return { phone: phone ?? null, recipientName, text, url: phone ? whatsappLink(phone, text) : null };
  }

  private templateFor(teacher: Teacher, charge: ChargeDto, today: string) {
    if (teacher.whatsappTemplate) return teacher.whatsappTemplate;
    if (charge.status === ChargeStatus.PAGO) {
      return 'Oi {nome}! Recebi o pagamento de {descricao} ({valor}). Muito obrigado(a)! 💜';
    }
    if (charge.dueDate < today) {
      return 'Oi {nome}! 😊 Tudo bem? Notei que {descricao} de {valor} venceu {vencimento} e ainda está em aberto.{pix}\nSe já pagou, me avise que eu atualizo aqui. Obrigado(a)!';
    }
    return DEFAULT_WHATSAPP_TEMPLATE;
  }

  private dueLabel(due: string, today: string) {
    const [, m, d] = due.split('-');
    if (due === today) return `hoje (${d}/${m})`;
    if (due === addDays(today, 1)) return `amanhã (${d}/${m})`;
    return `${due < today ? 'em' : 'dia'} ${d}/${m}`;
  }

  private base(teacherId: string) {
    return this.charges
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.student', 'st')
      .leftJoinAndSelect('c.payments', 'p')
      .where('c.teacherId = :teacherId', { teacherId });
  }

  private async toDtos(rows: Charge[], today: string): Promise<ChargeDto[]> {
    const ids = rows
      .filter((c) => c.kind === ChargeKind.AULAS_DO_MES || c.kind === ChargeKind.PACOTE)
      .map((c) => c.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const raw: { chargeId: string; n: string }[] = await this.lessons
        .createQueryBuilder('l')
        .select('l.chargeId', 'chargeId')
        .addSelect('COUNT(*)', 'n')
        .where({ chargeId: In(ids) })
        .groupBy('l.chargeId')
        .getRawMany();
      for (const r of raw) counts.set(r.chargeId, Number(r.n));
    }
    return rows.map((c) => toChargeDto(c, today, counts.get(c.id) ?? 0));
  }

  private async owned(teacherId: string, id: string) {
    const c = await this.charges.findOne({ where: { id, teacherId } });
    if (!c) throw new NotFoundException('Cobrança não encontrada');
    return c;
  }

  private async today(teacherId: string) {
    return todayIn((await this.teachers.findById(teacherId)).timezone);
  }
}
