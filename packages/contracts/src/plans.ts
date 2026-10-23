import { addDays, type IsoDate } from './dates';
import { BillingPlanType } from './enums';
import { formatBRL } from './money';

export const DUE_DAY_MIN = 1;
/** Até 28 para todo mês ter o dia de vencimento. */
export const DUE_DAY_MAX = 28;
export const MAX_PRICE_CENTS = 10_000_000; // R$ 100 mil
export const MAX_PACKAGE_LESSONS = 200;

export interface BillingPlanInput {
  type: BillingPlanType;
  monthlyFeeCents?: number | null;
  lessonPriceCents?: number | null;
  packageLessons?: number | null;
  packagePriceCents?: number | null;
  dueDay?: number | null;
  note?: string | null;
}

export interface BillingPlanDto extends Required<Omit<BillingPlanInput, 'note'>> {
  id: string;
  note: string | null;
  validFrom: IsoDate;
  validTo: IsoDate | null;
  createdAt: string;
}

export interface CreateBillingPlanRequest extends BillingPlanInput {
  /** Data a partir da qual o novo valor vale (reajuste). */
  validFrom: IsoDate;
}

const isPrice = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= MAX_PRICE_CENTS;
const isDueDay = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= DUE_DAY_MIN && v <= DUE_DAY_MAX;

export interface PlanFieldError {
  field: keyof BillingPlanInput;
  message: string;
}

/**
 * Valida os campos exigidos por tipo de plano e devolve só os relevantes (os demais viram null).
 * `errors` vem vazio quando está tudo certo; cada erro aponta o campo para o formulário.
 */
export function normalizePlanInput(input: BillingPlanInput): {
  plan: Required<Omit<BillingPlanInput, 'note'>> & { note: string | null };
  errors: PlanFieldError[];
} {
  const errors: PlanFieldError[] = [];
  const fail = (field: keyof BillingPlanInput, message: string) => errors.push({ field, message });
  const plan = {
    type: input.type,
    monthlyFeeCents: null as number | null,
    lessonPriceCents: null as number | null,
    packageLessons: null as number | null,
    packagePriceCents: null as number | null,
    dueDay: null as number | null,
    note: input.note?.trim() || null,
  };

  switch (input.type) {
    case BillingPlanType.MENSAL:
      if (!isPrice(input.monthlyFeeCents)) fail('monthlyFeeCents', 'Informe o valor da mensalidade');
      else plan.monthlyFeeCents = input.monthlyFeeCents;
      if (!isDueDay(input.dueDay)) fail('dueDay', 'Escolha o dia do vencimento (1 a 28)');
      else plan.dueDay = input.dueDay;
      break;
    case BillingPlanType.POR_AULA:
      if (!isPrice(input.lessonPriceCents)) fail('lessonPriceCents', 'Informe o valor da aula');
      else plan.lessonPriceCents = input.lessonPriceCents;
      if (!isDueDay(input.dueDay)) fail('dueDay', 'Escolha o dia do vencimento (1 a 28)');
      else plan.dueDay = input.dueDay;
      break;
    case BillingPlanType.PACOTE:
      if (
        typeof input.packageLessons !== 'number' ||
        !Number.isInteger(input.packageLessons) ||
        input.packageLessons < 1 ||
        input.packageLessons > MAX_PACKAGE_LESSONS
      ) {
        fail('packageLessons', 'Informe quantas aulas tem o pacote');
      } else plan.packageLessons = input.packageLessons;
      if (!isPrice(input.packagePriceCents)) fail('packagePriceCents', 'Informe o valor do pacote');
      else plan.packagePriceCents = input.packagePriceCents;
      break;
    default:
      fail('type', 'Tipo de plano inválido');
  }
  return { plan, errors };
}

export interface ResolvedPlans<P extends { validFrom: IsoDate; validTo: IsoDate | null }> {
  /** Plano em vigor hoje. */
  current: P | null;
  /** Reajuste agendado (começa depois de hoje). */
  upcoming: P | null;
  /** Planos encerrados, do mais recente para o mais antigo. */
  past: P[];
}

export function resolvePlans<P extends { validFrom: IsoDate; validTo: IsoDate | null }>(
  plans: P[],
  today: IsoDate,
): ResolvedPlans<P> {
  const sorted = [...plans].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  const current = sorted.find((p) => p.validFrom <= today && (!p.validTo || p.validTo >= today)) ?? null;
  const future = sorted.filter((p) => p.validFrom > today);
  const upcoming = future[future.length - 1] ?? null;
  const past = sorted.filter((p) => p.validTo && p.validTo < today);
  return { current, upcoming, past };
}

/** Ao criar um plano que começa em `validFrom`, o anterior termina no dia antes. */
export function previousPlanEnd(validFrom: IsoDate): IsoDate {
  return addDays(validFrom, -1);
}

export const PLAN_TYPE_LABEL: Record<BillingPlanType, string> = {
  MENSAL: 'Mensal',
  POR_AULA: 'Por aula',
  PACOTE: 'Pacote',
};

/** Resumo curto: 'R$ 280,00/mês · dia 10', 'R$ 70,00/aula · dia 5', '8 aulas por R$ 480,00'. */
export function describePlan(p: BillingPlanInput): string {
  switch (p.type) {
    case BillingPlanType.MENSAL:
      return `${formatBRL(p.monthlyFeeCents ?? 0)}/mês · dia ${p.dueDay}`;
    case BillingPlanType.POR_AULA:
      return `${formatBRL(p.lessonPriceCents ?? 0)}/aula · dia ${p.dueDay}`;
    case BillingPlanType.PACOTE:
      return `${p.packageLessons} aulas por ${formatBRL(p.packagePriceCents ?? 0)}`;
    default:
      return '';
  }
}

/** Valor de referência principal do plano (para comparar reajustes). */
export function planHeadlineCents(p: BillingPlanInput): number {
  return (
    (p.type === BillingPlanType.MENSAL
      ? p.monthlyFeeCents
      : p.type === BillingPlanType.POR_AULA
        ? p.lessonPriceCents
        : p.packagePriceCents) ?? 0
  );
}

/**
 * Plano que vale num dia. Antes do primeiro plano (aulas lançadas retroativamente),
 * usa o primeiro plano cadastrado.
 */
export function planAt<P extends { validFrom: IsoDate; validTo: IsoDate | null }>(plans: P[], day: IsoDate): P | null {
  const current = resolvePlans(plans, day).current;
  if (current) return current;
  const first = [...plans].sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0];
  return first && day < first.validFrom ? first : null;
}
