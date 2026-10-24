'use client';

import { displayName, formatBRL } from '@turmei/contracts';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { dueLabel } from '@/components/finance/charge-row';
import { useFinanceActions } from '@/components/finance/finance-actions';
import { WhatsappChargeButton } from '@/components/finance/whatsapp-button';
import { StudentAvatar } from '@/components/students/student-avatar';
import { Button } from '@/components/ui/button';
import { useFinanceHighlights } from '@/lib/queries/finance';
import { useToday } from '@/lib/use-today';
import { cn } from '@/lib/utils';

/** Pagamentos vencendo em 7 dias e atrasados, com "Cobrar" e "Recebi" a um toque. */
export function FinanceHighlights() {
  const today = useToday();
  const { data } = useFinanceHighlights();
  const { openCharge } = useFinanceActions();
  if (!data || (!data.dueSoon.length && !data.overdue.length)) return null;
  const items = [...data.overdue.map((c) => ({ c, late: true })), ...data.dueSoon.map((c) => ({ c, late: false }))].slice(0, 5);
  const more = data.overdue.length + data.dueSoon.length - items.length;

  return (
    <section className="animate-fade-up">
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="text-lg font-extrabold">Pagamentos</h2>
        <Link href="/financeiro" className="text-sm font-semibold text-primary">
          Financeiro
        </Link>
      </div>
      <div className="space-y-2">
        {items.map(({ c, late }) => (
          <div
            key={c.id}
            className={cn('flex items-center gap-3 rounded-3xl border p-3 shadow-soft', late ? 'border-transparent bg-danger-soft' : 'border-border bg-card')}
          >
            <button type="button" onClick={() => openCharge(c.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <StudentAvatar name={c.student.name} color={c.student.color} emoji={c.student.emoji} size="sm" />
              <span className="min-w-0">
                <span className="block truncate font-display font-extrabold">{displayName(c.student)}</span>
                <span className={cn('block truncate text-sm', late ? 'font-semibold text-danger-soft-foreground' : 'text-muted-foreground')}>
                  {formatBRL(c.balanceCents)} · {late ? `atrasado ${c.daysLate}d` : dueLabel(c.dueDate, today)}
                </span>
              </span>
            </button>
            <WhatsappChargeButton chargeId={c.id} size="icon" variant="soft" label="" aria-label="Cobrar no WhatsApp" className="size-10 bg-card text-success" />
            <Button size="sm" className="bg-success text-white shadow-none hover:bg-success" onClick={() => openCharge(c.id, 'pay')}>
              Recebi
            </Button>
          </div>
        ))}
      </div>
      {more > 0 ? (
        <Link href="/financeiro?status=abertas" className="mt-2 flex items-center justify-center gap-1 text-sm font-semibold text-primary">
          Mais {more} <ChevronRight className="size-4" />
        </Link>
      ) : null}
    </section>
  );
}
