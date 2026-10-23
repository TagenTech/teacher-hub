import { chargeStatus, ChargeKind, diffDays, type ChargeDto, type PaymentDto } from '@aulinha/contracts';
import { toStudentRef } from '../common/utils/student-ref';
import type { Charge } from './entities/charge.entity';
import type { Payment } from './entities/payment.entity';

export function toPaymentDto(p: Payment): PaymentDto {
  return {
    id: p.id,
    chargeId: p.chargeId,
    amountCents: p.amountCents,
    paidAt: p.paidAt,
    method: p.method,
    note: p.note,
    receiptNumber: p.receiptNumber,
    createdAt: p.createdAt.toISOString(),
  };
}

/** `lessonsCount`: aulas ligadas à cobrança (fechamento mensal ou pacote). */
export function toChargeDto(c: Charge, today: string, lessonsCount = 0): ChargeDto {
  const payments = [...(c.payments ?? [])].sort((a, b) => a.paidAt.localeCompare(b.paidAt));
  const paidCents = payments.reduce((s, p) => s + p.amountCents, 0);
  const netCents = Math.max(0, c.amountCents - c.discountCents);
  const status = chargeStatus(c, paidCents, today);
  // Atraso: no pagamento que quitou (pagas) ou até hoje (abertas).
  const settledOn = status === 'PAGO' ? (payments[payments.length - 1]?.paidAt ?? c.dueDate) : today;
  const daysLate = status === 'CANCELADO' ? 0 : Math.max(0, diffDays(c.dueDate, settledOn));
  const isPackage = c.kind === ChargeKind.PACOTE;
  return {
    id: c.id,
    student: toStudentRef(c.student),
    kind: c.kind,
    referenceMonth: c.referenceMonth,
    description: c.description,
    amountCents: c.amountCents,
    discountCents: c.discountCents,
    netCents,
    paidCents,
    balanceCents: Math.max(0, netCents - paidCents),
    dueDate: c.dueDate,
    status,
    daysLate,
    canceledAt: c.canceledAt?.toISOString() ?? null,
    lessonsCount: c.kind === ChargeKind.AULAS_DO_MES || isPackage ? lessonsCount : null,
    packageLessons: c.packageLessons,
    packageUsed: isPackage ? lessonsCount : null,
    payments: payments.map(toPaymentDto),
    createdAt: c.createdAt.toISOString(),
  };
}
