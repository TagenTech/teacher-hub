'use client';

import { ChargeStatus, displayName, formatBRL, type ChargeDto } from '@aulinha/contracts';
import { StudentAvatar } from '@/components/students/student-avatar';
import { cn } from '@/lib/utils';
import { ChargeStatusBadge } from './charge-status';
import { useFinanceActions } from './finance-actions';

export function dueLabel(due: string, today: string | null) {
  const [, m, d] = due.split('-');
  return due === today ? 'vence hoje' : `${due < (today ?? '') ? 'venceu' : 'vence'} ${d}/${m}`;
}

export function ChargeRow({ charge, today, showStudent = true }: { charge: ChargeDto; today: string | null; showStudent?: boolean }) {
  const { openCharge } = useFinanceActions();
  const paid = charge.status === ChargeStatus.PAGO;
  const canceled = charge.status === ChargeStatus.CANCELADO;
  return (
    <button
      type="button"
      onClick={() => openCharge(charge.id)}
      className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-muted active:bg-muted"
    >
      {showStudent ? (
        <StudentAvatar name={charge.student.name} color={charge.student.color} emoji={charge.student.emoji} size="sm" />
      ) : null}
      <span className={cn('min-w-0 flex-1', canceled && 'opacity-60')}>
        <span className="block truncate font-display font-extrabold">
          {showStudent ? displayName(charge.student) : charge.description}
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {showStudent ? `${charge.description} · ` : ''}
          {paid && charge.payments.length
            ? `pago ${charge.payments[charge.payments.length - 1].paidAt.split('-').reverse().slice(0, 2).join('/')}`
            : dueLabel(charge.dueDate, today)}
          {charge.packageLessons ? ` · ${charge.packageUsed ?? 0}/${charge.packageLessons} aulas` : ''}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className={cn('font-display font-black tabular', canceled && 'line-through opacity-60')}>
          {formatBRL(paid || canceled ? charge.netCents : charge.balanceCents)}
        </span>
        <ChargeStatusBadge status={charge.status} daysLate={charge.daysLate} />
      </span>
    </button>
  );
}
