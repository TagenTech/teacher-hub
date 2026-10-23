'use client';

import {
  describePlan,
  formatBRL,
  formatDateShort,
  PLAN_TYPE_LABEL,
  planHeadlineCents,
  type BillingPlanDto,
  type StudentDetailDto,
} from '@aulinha/contracts';
import { CalendarClock, TrendingUp, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError } from '@/lib/api/client';
import { useRemovePlan } from '@/lib/queries/students';

function headline(p: BillingPlanDto) {
  const value = formatBRL(planHeadlineCents(p));
  if (p.type === 'MENSAL') return { value, unit: '/mês', extra: `Vence todo dia ${p.dueDay}` };
  if (p.type === 'POR_AULA') return { value, unit: '/aula', extra: `Fechamento todo dia ${p.dueDay}` };
  return {
    value,
    unit: `/${p.packageLessons} aulas`,
    extra: `${formatBRL(Math.round((p.packagePriceCents ?? 0) / (p.packageLessons || 1)))} por aula`,
  };
}

/** Variação em relação ao plano anterior do mesmo tipo: '+7%'. */
function change(p: BillingPlanDto, prev?: BillingPlanDto) {
  if (!prev || prev.type !== p.type) return null;
  const a = planHeadlineCents(prev);
  const b = planHeadlineCents(p);
  if (!a || a === b) return null;
  const pct = Math.round(((b - a) / a) * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function period(p: BillingPlanDto) {
  return p.validTo
    ? `${formatDateShort(p.validFrom)} → ${formatDateShort(p.validTo)}`
    : `desde ${formatDateShort(p.validFrom)}`;
}

export function PlanTab({ student, onChangePlan }: { student: StudentDetailDto; onChangePlan: () => void }) {
  const removePlan = useRemovePlan(student.id);
  const { currentPlan: current, upcomingPlan: upcoming, plans } = student;
  const latestId = plans[0]?.id;
  const canUndo = plans.length > 1;

  const undo = async (plan: BillingPlanDto) => {
    try {
      await removePlan.mutateAsync(plan.id);
      toast.success('Reajuste desfeito');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível desfazer');
    }
  };

  return (
    <div className="space-y-5">
      {current ? (
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#8f7cf8] to-[#f28db8] p-6 text-white shadow-float">
          <div aria-hidden className="absolute -right-8 -top-8 size-36 rounded-full bg-white/15" />
          <p className="font-display text-sm font-bold uppercase tracking-wider text-white/80">
            Plano {PLAN_TYPE_LABEL[current.type]}
          </p>
          <p className="mt-1 font-display text-4xl font-black tabular">
            {headline(current).value}
            <span className="text-lg font-bold text-white/80">{headline(current).unit}</span>
          </p>
          <p className="mt-1 text-white/90">{headline(current).extra}</p>
          {current.note ? <p className="mt-3 text-sm text-white/80">“{current.note}”</p> : null}
        </div>
      ) : (
        <Card className="text-center text-muted-foreground">Nenhum plano em vigor hoje.</Card>
      )}

      {upcoming ? (
        <div className="flex items-center gap-3 rounded-3xl bg-warning-soft p-4 text-warning-soft-foreground">
          <CalendarClock className="size-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-display font-extrabold">Reajuste agendado</p>
            <p className="text-sm">
              {describePlan(upcoming)} a partir de {formatDateShort(upcoming.validFrom)}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-warning-soft-foreground"
            loading={removePlan.isPending}
            onClick={() => undo(upcoming)}
          >
            Desfazer
          </Button>
        </div>
      ) : null}

      <Button variant="soft" size="lg" block onClick={onChangePlan}>
        <TrendingUp /> Reajustar ou mudar plano
      </Button>

      <section>
        <h3 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Histórico</h3>
        <Card className="p-2">
          <ol className="relative">
            {plans.map((p, i) => {
              const delta = change(p, plans[i + 1]);
              const isCurrent = p.id === current?.id;
              return (
                <li key={p.id} className="flex gap-3 rounded-2xl p-3">
                  <span className="flex flex-col items-center pt-1.5" aria-hidden>
                    <span
                      className={
                        isCurrent
                          ? 'size-3 rounded-full bg-primary ring-4 ring-primary-soft'
                          : 'size-3 rounded-full bg-border'
                      }
                    />
                    {i < plans.length - 1 ? <span className="mt-1 w-0.5 flex-1 bg-border" /> : null}
                  </span>
                  <div className="min-w-0 flex-1 pb-1">
                    <p className="font-semibold">
                      {describePlan(p)}
                      {delta ? (
                        <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold text-success-soft-foreground">
                          {delta}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {period(p)}
                      {isCurrent ? ' · em vigor' : ''}
                    </p>
                    {p.note ? <p className="text-sm italic text-muted-foreground">“{p.note}”</p> : null}
                  </div>
                  {p.id === latestId && canUndo && p.id !== upcoming?.id ? (
                    <button
                      type="button"
                      onClick={() => undo(p)}
                      aria-label="Desfazer este reajuste"
                      className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
                    >
                      <Undo2 className="size-4" />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </Card>
      </section>
    </div>
  );
}
