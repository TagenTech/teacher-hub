import type { IsoDate } from './dates';
import { ChargeStatus, type ChargeKind, type PaymentMethod } from './enums';
import type { StudentRefDto } from './lessons';
import type { YearMonth } from './time';

export interface PaymentDto {
  id: string;
  chargeId: string;
  amountCents: number;
  paidAt: IsoDate;
  method: PaymentMethod;
  note: string | null;
  receiptNumber: string;
  createdAt: string;
}

export interface ChargeDto {
  id: string;
  student: StudentRefDto;
  kind: ChargeKind;
  referenceMonth: YearMonth | null;
  description: string;
  amountCents: number;
  discountCents: number;
  netCents: number;
  paidCents: number;
  balanceCents: number;
  dueDate: IsoDate;
  status: ChargeStatus;
  /** Dias de atraso hoje (aberta) ou no pagamento (paga). 0 se em dia. */
  daysLate: number;
  canceledAt: string | null;
  lessonsCount: number | null;
  packageLessons: number | null;
  packageUsed: number | null;
  payments: PaymentDto[];
  createdAt: string;
}

export interface CreateChargeRequest {
  studentId: string;
  kind?: ChargeKind;
  description: string;
  amountCents: number;
  dueDate: IsoDate;
}

export interface UpdateChargeRequest {
  description?: string;
  amountCents?: number;
  discountCents?: number;
  dueDate?: IsoDate;
}

export interface RegisterPaymentRequest {
  amountCents: number;
  paidAt: IsoDate;
  method: PaymentMethod;
  note?: string | null;
}

export interface WhatsappMessageDto {
  phone: string | null;
  recipientName: string;
  text: string;
  url: string | null;
}

export interface MonthSummaryDto {
  month: YearMonth;
  expectedCents: number;
  receivedCents: number;
  openCents: number;
  overdueCents: number;
  chargesCount: number;
  paidCount: number;
  overdueCount: number;
}

export interface ReceiptDto {
  payment: PaymentDto;
  charge: ChargeDto;
  teacherName: string;
  payerName: string;
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO: 'Cartão',
  TRANSFERENCIA: 'Transferência',
  OUTRO: 'Outro',
};

export const CHARGE_STATUS_LABEL: Record<ChargeStatus, string> = {
  PENDENTE: 'Pendente',
  PARCIAL: 'Parcial',
  PAGO: 'Pago',
  ATRASADO: 'Atrasado',
  CANCELADO: 'Cancelado',
};

export const DEFAULT_WHATSAPP_TEMPLATE =
  'Oi {nome}! 😊 Passando para lembrar: {descricao} de {valor} vence {vencimento}.{pix}\nQualquer coisa é só me chamar. Obrigado(a)!';

/** Status da cobrança — sempre derivado, nunca gravado. */
export function chargeStatus(
  c: { amountCents: number; discountCents: number; dueDate: IsoDate; canceledAt: unknown },
  paidCents: number,
  today: IsoDate,
): ChargeStatus {
  if (c.canceledAt) return ChargeStatus.CANCELADO;
  const net = Math.max(0, c.amountCents - c.discountCents);
  if (paidCents >= net) return ChargeStatus.PAGO;
  if (c.dueDate < today) return ChargeStatus.ATRASADO;
  if (paidCents > 0) return ChargeStatus.PARCIAL;
  return ChargeStatus.PENDENTE;
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}
