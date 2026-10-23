'use client';

import { addMonths, formatBRL, monthLabel, monthOf } from '@aulinha/contracts';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { ChargeRow } from '@/components/finance/charge-row';
import { useFinanceActions } from '@/components/finance/finance-actions';
import { ProgressRing } from '@/components/finance/progress-ring';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChargeFilter } from '@/lib/api/finance';
import { capitalize } from '@/lib/format';
import { useCharges, useMonthSummary } from '@/lib/queries/finance';
import { useToday } from '@/lib/use-today';

const FILTERS: { v: ChargeFilter; l: string }[] = [
  { v: 'abertas', l: 'A receber' },
  { v: 'atrasadas', l: 'Atrasadas' },
  { v: 'pagas', l: 'Pagas' },
  { v: 'todas', l: 'Todas' },
];

function FinanceiroInner() {
  const today = useToday();
  const params = useSearchParams();
  const { openNewCharge } = useFinanceActions();
  const [month, setMonth] = React.useState<string | null>(null);
  const initial = params.get('status');
  const [filter, setFilter] = React.useState<ChargeFilter>(
    initial === 'atrasadas' || initial === 'pagas' || initial === 'todas' ? initial : 'abertas',
  );
  const m = month ?? (today ? monthOf(today) : null);
  const { data: summary } = useMonthSummary(m);
  const { data: charges, isPending } = useCharges({ month: m ?? undefined, status: filter }, !!m);

  if (!m || !today) return <Skeleton className="m-5 h-96" />;
  const pct = summary && summary.expectedCents ? summary.receivedCents / summary.expectedCents : 0;
  const allPaid = summary && summary.chargesCount > 0 && summary.paidCount === summary.chargesCount;

  return (
    <>
      <header className="flex items-end justify-between gap-3 px-5 pb-3 pt-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Mensalidades e pagamentos</p>
          <h1 className="text-3xl font-black">Financeiro</h1>
        </div>
        <Button size="sm" variant="soft" onClick={() => openNewCharge()}>
          <Plus className="!size-4" /> Cobrança
        </Button>
      </header>

      <div className="space-y-5 px-5 pb-4">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Mês anterior" onClick={() => setMonth(addMonths(m, -1))} className="grid size-10 place-items-center rounded-xl hover:bg-muted">
            <ChevronLeft className="size-5" />
          </button>
          <p className="font-display text-lg font-extrabold">{capitalize(monthLabel(m))}</p>
          <button type="button" aria-label="Próximo mês" onClick={() => setMonth(addMonths(m, 1))} className="grid size-10 place-items-center rounded-xl hover:bg-muted">
            <ChevronRight className="size-5" />
          </button>
        </div>

        <section className="relative flex items-center gap-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#5fc9a0] via-[#8f7cf8] to-[#f28db8] p-5 text-white shadow-float">
          <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-white/15" />
          <ProgressRing value={pct}>
            <div>
              <p className="font-display text-2xl font-black">{Math.round(pct * 100)}%</p>
              <p className="text-[11px] font-bold uppercase text-white/80">recebido</p>
            </div>
          </ProgressRing>
          <div className="min-w-0 flex-1 space-y-1">
            {summary ? (
              <>
                <p className="text-sm text-white/80">Recebido</p>
                <p className="font-display text-2xl font-black tabular">{formatBRL(summary.receivedCents)}</p>
                <p className="text-sm text-white/90">de {formatBRL(summary.expectedCents)} previstos</p>
                <p className="text-sm font-semibold">{allPaid ? 'Mês todo recebido! 🎉' : `${summary.paidCount}/${summary.chargesCount} pagas`}</p>
              </>
            ) : (
              <Skeleton className="h-20 bg-white/20" />
            )}
          </div>
        </section>

        {summary ? (
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">A receber no mês</p>
              <p className="mt-1 font-display text-xl font-black tabular">{formatBRL(summary.openCents)}</p>
            </Card>
            <button type="button" onClick={() => setFilter('atrasadas')} className="text-left">
              <Card className={summary.overdueCount ? 'bg-danger-soft p-4' : 'p-4'}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Em atraso</p>
                <p className={`mt-1 font-display text-xl font-black tabular ${summary.overdueCount ? 'text-danger-soft-foreground' : ''}`}>
                  {formatBRL(summary.overdueCents)}
                </p>
                <p className="text-xs text-muted-foreground">{summary.overdueCount} cobrança(s)</p>
              </Card>
            </button>
          </div>
        ) : null}

        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 scrollbar-none">
          {FILTERS.map((f) => (
            <Chip key={f.v} active={filter === f.v} onClick={() => setFilter(f.v)}>
              {f.l}
            </Chip>
          ))}
        </div>
        {filter === 'atrasadas' ? (
          <p className="-mt-2 px-1 text-sm text-muted-foreground">Todas as cobranças vencidas, de qualquer mês.</p>
        ) : null}

        {isPending && !charges ? (
          <Skeleton className="h-48" />
        ) : charges?.length ? (
          <Card className="p-1.5">
            {charges.map((c) => (
              <ChargeRow key={c.id} charge={c} today={today} />
            ))}
          </Card>
        ) : (
          <EmptyState
            emoji={filter === 'atrasadas' ? '🌈' : filter === 'pagas' ? '🪙' : '💸'}
            tone={filter === 'atrasadas' ? 'success' : 'primary'}
            title={filter === 'atrasadas' ? 'Ninguém em atraso!' : filter === 'abertas' ? 'Nada a receber' : 'Nenhuma cobrança'}
            description={
              filter === 'abertas'
                ? 'Tudo recebido neste mês — ou ainda não há cobranças. As mensalidades aparecem sozinhas, 7 dias antes do vencimento.'
                : 'Nada por aqui neste filtro.'
            }
            className="py-8"
          />
        )}
      </div>
    </>
  );
}

export default function FinanceiroPage() {
  return (
    <Suspense>
      <FinanceiroInner />
    </Suspense>
  );
}
