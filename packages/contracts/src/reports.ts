import type { IsoDate } from './dates';
import type { BillingPlanType, PaymentMethod } from './enums';
import type { StudentRefDto } from './lessons';
import type { YearMonth } from './time';

export interface ReportFilters {
  from: IsoDate;
  to: IsoDate;
  studentIds?: string[];
  tags?: string[];
  methods?: PaymentMethod[];
  planTypes?: BillingPlanType[];
  onlyLate?: boolean;
}

export interface ReportSummaryDto {
  receivedCents: number;
  expectedCents: number;
  openCents: number;
  overdueCents: number;
  paymentsCount: number;
  averageTicketCents: number;
  lessons: { realized: number; studentAbsences: number; teacherAbsences: number; canceled: number };
  byMonth: { month: YearMonth; receivedCents: number; expectedCents: number }[];
  byMethod: { method: PaymentMethod; cents: number; count: number }[];
  byStudent: { student: StudentRefDto; receivedCents: number; openCents: number }[];
}

export const PayerBadge = { EM_DIA: 'EM_DIA', AS_VEZES: 'AS_VEZES', SEMPRE: 'SEMPRE' } as const;
export type PayerBadge = (typeof PayerBadge)[keyof typeof PayerBadge];

export interface LatePayerDto {
  student: StudentRefDto;
  chargesCount: number;
  lateCount: number;
  latePct: number;
  avgDaysLate: number;
  maxDaysLate: number;
  overdueCents: number;
  overdueCount: number;
  score: number;
  badge: PayerBadge;
}

export interface AttendanceRowDto {
  student: StudentRefDto;
  total: number;
  realized: number;
  studentAbsences: number;
  justifiedAbsences: number;
  teacherAbsences: number;
  canceled: number;
  /** Realizadas / (realizadas + faltas do aluno), 0–100. */
  rate: number;
}

export const SavedFilterScope = { RELATORIOS: 'RELATORIOS' } as const;
export type SavedFilterScope = (typeof SavedFilterScope)[keyof typeof SavedFilterScope];

export interface SavedFilterDto {
  id: string;
  name: string;
  scope: SavedFilterScope;
  /** Período relativo ('mes', 'mes-passado', '3-meses', 'ano') ou fixo (from/to). */
  period: string;
  criteria: Omit<ReportFilters, 'from' | 'to'> & { from?: IsoDate; to?: IsoDate };
  pinned: boolean;
  createdAt: string;
}

export interface SaveFilterRequest {
  name: string;
  period: string;
  criteria: SavedFilterDto['criteria'];
  pinned?: boolean;
}

/**
 * Pontuação de atraso (0–100): mistura frequência (% de cobranças pagas/abertas com atraso)
 * e intensidade (média de dias, saturando em 30). Quem tem atraso em aberto hoje ganha peso extra.
 */
export function latenessScore(latePct: number, avgDaysLate: number, hasOverdueNow: boolean): number {
  const intensity = Math.min(avgDaysLate, 30) / 30;
  return Math.round(Math.min(100, latePct * 0.6 + intensity * 100 * 0.3 + (hasOverdueNow ? 10 : 0)));
}

export function payerBadge(score: number): PayerBadge {
  return score < 15 ? PayerBadge.EM_DIA : score < 45 ? PayerBadge.AS_VEZES : PayerBadge.SEMPRE;
}
