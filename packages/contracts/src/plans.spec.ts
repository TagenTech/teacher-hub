import { BillingPlanType } from './enums';
import { describePlan, normalizePlanInput, planAt, previousPlanEnd, resolvePlans } from './plans';

const p = (validFrom: string, validTo: string | null) => ({ validFrom, validTo });

describe('normalizePlanInput', () => {
  it('mensal exige valor e dia, e descarta campos de outros tipos', () => {
    const { plan, errors } = normalizePlanInput({
      type: BillingPlanType.MENSAL,
      monthlyFeeCents: 28000,
      dueDay: 10,
      lessonPriceCents: 5000,
    });
    expect(errors).toEqual([]);
    expect(plan.lessonPriceCents).toBeNull();
    expect(plan.monthlyFeeCents).toBe(28000);
  });

  it('aponta campos faltando', () => {
    expect(normalizePlanInput({ type: BillingPlanType.POR_AULA, dueDay: 31 }).errors).toEqual([
      { field: 'lessonPriceCents', message: 'Informe o valor da aula' },
      { field: 'dueDay', message: 'Escolha o dia do vencimento (1 a 28)' },
    ]);
    expect(normalizePlanInput({ type: BillingPlanType.PACOTE, packageLessons: 0 }).errors).toHaveLength(2);
  });

  it('pacote não tem vencimento', () => {
    const { plan, errors } = normalizePlanInput({
      type: BillingPlanType.PACOTE,
      packageLessons: 8,
      packagePriceCents: 48000,
      dueDay: 10,
    });
    expect(errors).toEqual([]);
    expect(plan.dueDay).toBeNull();
  });
});

describe('resolvePlans', () => {
  const plans = [p('2025-01-01', '2025-12-31'), p('2026-01-01', '2026-10-31'), p('2026-11-01', null)];

  it('separa vigente, reajuste agendado e histórico', () => {
    const r = resolvePlans(plans, '2026-10-22');
    expect(r.current).toBe(plans[1]);
    expect(r.upcoming).toBe(plans[2]);
    expect(r.past).toEqual([plans[0]]);
  });

  it('no dia do reajuste o novo plano vira o vigente', () => {
    const r = resolvePlans(plans, '2026-11-01');
    expect(r.current).toBe(plans[2]);
    expect(r.upcoming).toBeNull();
  });

  it('previousPlanEnd é o dia anterior', () => {
    expect(previousPlanEnd('2026-11-01')).toBe('2026-10-31');
  });
});

describe('describePlan', () => {
  it('resume cada tipo', () => {
    const nbsp = (s: string) => s.replace(/\s/g, ' ');
    expect(nbsp(describePlan({ type: 'MENSAL', monthlyFeeCents: 28000, dueDay: 10 }))).toBe(
      'R$ 280,00/mês · dia 10',
    );
    expect(nbsp(describePlan({ type: 'PACOTE', packageLessons: 8, packagePriceCents: 48000 }))).toBe(
      '8 aulas por R$ 480,00',
    );
  });
});

describe('planAt', () => {
  it('usa o primeiro plano para datas anteriores a ele', () => {
    const plans = [p('2026-10-01', null)];
    expect(planAt(plans, '2026-09-15')).toBe(plans[0]);
    expect(planAt(plans, '2026-10-15')).toBe(plans[0]);
    expect(planAt([], '2026-10-15')).toBeNull();
  });
});
