'use client';

import { formatBRL, monthLabel } from '@aulinha/contracts';
import * as React from 'react';
import { capitalize } from '@/lib/format';
import { cn } from '@/lib/utils';

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const axisMoney = (cents: number) => (cents >= 100_000 ? `${compact.format(cents / 100)}` : String(Math.round(cents / 100)));

/** Teto "redondo" para o eixo: 1, 2 ou 5 × 10^n. */
function niceMax(v: number) {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((m) => m >= v)!;
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

interface MonthPoint {
  month: string;
  receivedCents: number;
  expectedCents: number;
}

/**
 * Colunas agrupadas por mês (recebido × previsto). Um eixo só, colunas finas com ponta
 * arredondada, linhas de grade discretas, toque/hover mostra os valores.
 */
export function MonthColumns({ data }: { data: MonthPoint[] }) {
  const [active, setActive] = React.useState<number | null>(null);
  const [table, setTable] = React.useState(false);
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.receivedCents, d.expectedCents))));
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const sel = active ?? data.length - 1;
  const current = data[sel];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Legend
          items={[
            { label: 'Recebido', color: 'var(--chart-1)' },
            { label: 'Previsto', color: 'var(--chart-2)' },
          ]}
        />
        <button type="button" onClick={() => setTable((t) => !t)} className="text-sm font-semibold text-primary">
          {table ? 'Ver gráfico' : 'Ver tabela'}
        </button>
      </div>

      {table ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="py-1.5 font-bold">Mês</th>
              <th className="py-1.5 text-right font-bold">Recebido</th>
              <th className="py-1.5 text-right font-bold">Previsto</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {data.map((d) => (
              <tr key={d.month} className="border-t border-border">
                <td className="py-2 capitalize">{monthLabel(d.month, false)}</td>
                <td className="py-2 text-right font-semibold">{formatBRL(d.receivedCents)}</td>
                <td className="py-2 text-right text-muted-foreground">{formatBRL(d.expectedCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          {current ? (
            <div className="rounded-2xl bg-muted/70 px-4 py-2.5 text-sm" aria-live="polite">
              <span className="font-bold">{capitalize(monthLabel(current.month))}</span>
              <span className="text-muted-foreground"> · recebido </span>
              <span className="font-semibold tabular">{formatBRL(current.receivedCents)}</span>
              <span className="text-muted-foreground"> de </span>
              <span className="font-semibold tabular">{formatBRL(current.expectedCents)}</span>
            </div>
          ) : null}
          <div className="relative h-48 pl-9" role="img" aria-label="Recebido e previsto por mês">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute left-9 right-0 border-t border-[var(--chart-grid)]"
                style={{ bottom: `${(t / max) * 100}%` }}
              >
                <span className="absolute -left-9 -top-2 w-8 text-right text-[11px] text-muted-foreground tabular">
                  {axisMoney(t)}
                </span>
              </div>
            ))}
            <div className="absolute inset-y-0 left-9 right-0 flex items-end justify-around">
              {data.map((d, i) => (
                <button
                  key={d.month}
                  type="button"
                  onClick={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  aria-label={`${monthLabel(d.month)}: recebido ${formatBRL(d.receivedCents)}, previsto ${formatBRL(d.expectedCents)}`}
                  className={cn(
                    'flex h-full flex-1 items-end justify-center gap-[2px] rounded-xl transition-colors',
                    i === sel ? 'bg-muted/60' : 'hover:bg-muted/40',
                  )}
                >
                  {[
                    { v: d.receivedCents, c: 'var(--chart-1)' },
                    { v: d.expectedCents, c: 'var(--chart-2)' },
                  ].map((b, j) => (
                    <span
                      key={j}
                      className="w-[min(14px,30%)] rounded-t-[4px] transition-all duration-500"
                      style={{ height: `${Math.max((b.v / max) * 100, b.v ? 1.5 : 0)}%`, background: b.c }}
                    />
                  ))}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-around pl-9">
            {data.map((d, i) => (
              <span key={d.month} className={cn('flex-1 text-center text-xs capitalize', i === sel ? 'font-bold' : 'text-muted-foreground')}>
                {monthLabel(d.month, false).slice(0, 3)}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Barras horizontais de uma série só (valor na ponta, rótulo à esquerda). */
export function HorizontalBars({
  rows,
  format = formatBRL,
}: {
  rows: { key: string; label: React.ReactNode; value: number; hint?: string }[];
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="space-y-1" title={r.hint}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold">{r.label}</span>
            <span className="shrink-0 font-semibold tabular">{format(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(r.value / max) * 100}%`, background: 'var(--chart-1)' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'danger' | 'success' }) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-border bg-card p-4 shadow-soft',
        tone === 'danger' && 'border-transparent bg-danger-soft',
        tone === 'success' && 'border-transparent bg-success-soft',
      )}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 font-display text-xl font-black tabular',
          tone === 'danger' && 'text-danger-soft-foreground',
          tone === 'success' && 'text-success-soft-foreground',
        )}
      >
        {value}
      </p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
