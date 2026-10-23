'use client';

import { BillingPlanType, DUE_DAY_MAX, formatBRL } from '@aulinha/contracts';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { cn, haptic } from '@/lib/utils';
import type { PlanFormValues } from '@/lib/students/form';

const TYPES = [
  { value: BillingPlanType.MENSAL, emoji: '📅', title: 'Mensal', text: 'Valor fixo todo mês' },
  { value: BillingPlanType.POR_AULA, emoji: '🎟️', title: 'Por aula', text: 'Paga as aulas do mês' },
  { value: BillingPlanType.PACOTE, emoji: '📦', title: 'Pacote', text: 'N aulas por um valor' },
];

type WithPlan = { plan: PlanFormValues };

/** Campos do plano de cobrança. Precisa de um formulário com a chave `plan` (FormProvider). */
export function PlanFields() {
  const { control, register, formState } = useFormContext<WithPlan>();
  const type = useWatch({ control, name: 'plan.type' });
  const packageLessons = useWatch({ control, name: 'plan.packageLessons' });
  const packagePrice = useWatch({ control, name: 'plan.packagePriceCents' });
  const errors = formState.errors.plan;

  return (
    <div className="space-y-5">
      <Controller
        control={control}
        name="plan.type"
        render={({ field }) => (
          <div role="radiogroup" aria-label="Tipo de cobrança" className="grid grid-cols-3 gap-2.5">
            {TYPES.map((t) => {
              const active = field.value === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    haptic(8);
                    field.onChange(t.value);
                  }}
                  className={cn(
                    'flex flex-col items-center rounded-2xl border-2 px-2 py-3.5 text-center transition-all active:scale-95',
                    active ? 'border-primary bg-primary-soft' : 'border-input bg-card',
                  )}
                >
                  <span className="text-2xl" aria-hidden>
                    {t.emoji}
                  </span>
                  <span
                    className={cn(
                      'mt-1 font-display font-extrabold',
                      active && 'text-primary-soft-foreground',
                    )}
                  >
                    {t.title}
                  </span>
                  <span className="mt-0.5 text-xs leading-tight text-muted-foreground">{t.text}</span>
                </button>
              );
            })}
          </div>
        )}
      />

      {type === BillingPlanType.MENSAL ? (
        <Field label="Valor da mensalidade" htmlFor="plan-monthly" error={errors?.monthlyFeeCents?.message}>
          <Controller
            control={control}
            name="plan.monthlyFeeCents"
            render={({ field }) => (
              <MoneyInput
                id="plan-monthly"
                value={field.value}
                onChange={field.onChange}
                invalid={!!errors?.monthlyFeeCents}
              />
            )}
          />
        </Field>
      ) : null}

      {type === BillingPlanType.POR_AULA ? (
        <Field label="Valor de cada aula" htmlFor="plan-lesson" error={errors?.lessonPriceCents?.message}>
          <Controller
            control={control}
            name="plan.lessonPriceCents"
            render={({ field }) => (
              <MoneyInput
                id="plan-lesson"
                value={field.value}
                onChange={field.onChange}
                invalid={!!errors?.lessonPriceCents}
              />
            )}
          />
        </Field>
      ) : null}

      {type === BillingPlanType.PACOTE ? (
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Field label="Aulas" htmlFor="plan-pkg-lessons" error={errors?.packageLessons?.message}>
            <Input
              id="plan-pkg-lessons"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="8"
              invalid={!!errors?.packageLessons}
              {...register('plan.packageLessons', {
                setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
              })}
            />
          </Field>
          <Field label="Valor do pacote" htmlFor="plan-pkg-price" error={errors?.packagePriceCents?.message}>
            <Controller
              control={control}
              name="plan.packagePriceCents"
              render={({ field }) => (
                <MoneyInput
                  id="plan-pkg-price"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={!!errors?.packagePriceCents}
                />
              )}
            />
          </Field>
          {packageLessons && packagePrice ? (
            <p className="col-span-2 -mt-1 pl-1 text-sm text-muted-foreground">
              Sai {formatBRL(Math.round(packagePrice / packageLessons))} por aula ✨
            </p>
          ) : null}
        </div>
      ) : null}

      {type !== BillingPlanType.PACOTE ? (
        <div className="space-y-1.5">
          <p className="pl-1 text-sm font-semibold" id="plan-due-label">
            Dia do vencimento
          </p>
          <Controller
            control={control}
            name="plan.dueDay"
            render={({ field }) => (
              <div role="radiogroup" aria-labelledby="plan-due-label" className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: DUE_DAY_MAX }, (_, i) => i + 1).map((day) => {
                  const active = field.value === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={`Dia ${day}`}
                      onClick={() => {
                        haptic(6);
                        field.onChange(day);
                      }}
                      className={cn(
                        'aspect-square rounded-xl text-sm font-bold tabular transition-all active:scale-90',
                        active ? 'bg-primary text-primary-foreground shadow-float' : 'bg-muted text-foreground',
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            )}
          />
          {errors?.dueDay ? (
            <p role="alert" className="pl-1 text-sm font-medium text-danger">
              {errors.dueDay.message}
            </p>
          ) : (
            <p className="pl-1 text-sm text-muted-foreground">
              {type === BillingPlanType.POR_AULA
                ? 'As aulas do mês são cobradas juntas nesse dia.'
                : 'Você recebe um lembrete um dia antes.'}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
