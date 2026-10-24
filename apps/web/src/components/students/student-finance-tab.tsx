'use client';

import { BillingPlanType, formatBRL, monthLabel, monthOf, type StudentDetailDto } from '@turmei/contracts';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ChargeRow } from '@/components/finance/charge-row';
import { useFinanceActions } from '@/components/finance/finance-actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError } from '@/lib/api/client';
import { useBillingPreview, useCharges, useCloseMonth } from '@/lib/queries/finance';
import { PlanTab } from './plan-history';

export function StudentFinanceTab({ student, today, onChangePlan }: { student: StudentDetailDto; today: string; onChangePlan: () => void }) {
  const { openNewCharge } = useFinanceActions();
  const { data: charges } = useCharges({ studentId: student.id, status: 'todas' });
  const perLesson = student.currentPlan?.type === BillingPlanType.POR_AULA;
  const { data: preview } = useBillingPreview(student.id);
  const close = useCloseMonth();
  const open = (charges ?? []).filter((c) => c.balanceCents > 0 && c.status !== 'CANCELADO');
  const openTotal = open.reduce((s, c) => s + c.balanceCents, 0);

  return (
    <div className="space-y-6">
      {openTotal ? (
        <div className="rounded-3xl bg-warning-soft p-4 text-warning-soft-foreground">
          <p className="text-sm font-semibold">Em aberto</p>
          <p className="font-display text-2xl font-black tabular">{formatBRL(openTotal)}</p>
          <p className="text-sm">{open.length} cobrança(s)</p>
        </div>
      ) : charges?.length ? (
        <div className="rounded-3xl bg-success-soft p-4 font-display font-extrabold text-success-soft-foreground">Tudo em dia ✓</div>
      ) : null}

      {perLesson && preview && preview.lessonsCount ? (
        <Card className="space-y-3">
          <div>
            <p className="font-display font-extrabold">Aulas de {monthLabel(preview.month, false)} até agora</p>
            <p className="text-sm text-muted-foreground">
              {preview.lessonsCount} aula(s) · {formatBRL(preview.amountCents)} — fecha sozinho no fim do mês.
            </p>
          </div>
          <Button
            variant="soft"
            size="sm"
            loading={close.isPending}
            onClick={() =>
              close.mutate(
                { studentId: student.id, month: monthOf(today) },
                {
                  onSuccess: () => toast.success('Mês fechado — cobrança criada 💰'),
                  onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Não foi possível fechar'),
                },
              )
            }
          >
            Fechar mês agora
          </Button>
        </Card>
      ) : null}

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Cobranças</h3>
          <Button size="sm" variant="ghost" onClick={() => openNewCharge(student.id)}>
            <Plus className="!size-4" /> Avulsa
          </Button>
        </div>
        {charges?.length ? (
          <Card className="p-1.5">
            {charges.slice(0, 24).map((c) => (
              <ChargeRow key={c.id} charge={c} today={today} showStudent={false} />
            ))}
          </Card>
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            Nenhuma cobrança ainda. As mensalidades aparecem 7 dias antes do vencimento.
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Plano</h3>
        <PlanTab student={student} onChangePlan={onChangePlan} />
      </section>
    </div>
  );
}
