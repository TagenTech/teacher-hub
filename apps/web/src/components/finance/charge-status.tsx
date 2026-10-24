import { CHARGE_STATUS_LABEL, ChargeStatus } from '@turmei/contracts';
import { cn } from '@/lib/utils';

const TONE: Record<ChargeStatus, string> = {
  PENDENTE: 'bg-primary-soft text-primary-soft-foreground',
  PARCIAL: 'bg-warning-soft text-warning-soft-foreground',
  PAGO: 'bg-success-soft text-success-soft-foreground',
  ATRASADO: 'bg-danger-soft text-danger-soft-foreground',
  CANCELADO: 'bg-muted text-muted-foreground',
};

export function ChargeStatusBadge({ status, daysLate, className }: { status: ChargeStatus; daysLate?: number; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold', TONE[status], className)}>
      {status === ChargeStatus.PAGO ? '✓ ' : ''}
      {CHARGE_STATUS_LABEL[status]}
      {status === ChargeStatus.ATRASADO && daysLate ? ` · ${daysLate}d` : ''}
    </span>
  );
}
