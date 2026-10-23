import { formatDateShort, StudentStatus, type IsoDate } from '@aulinha/contracts';
import { cn } from '@/lib/utils';

export function StudentStatusBadge({
  status,
  pausedUntil,
  compact,
  className,
}: {
  status: StudentStatus;
  pausedUntil?: IsoDate | null;
  /** Só o status, sem a data de volta (listas). */
  compact?: boolean;
  className?: string;
}) {
  if (status === StudentStatus.ATIVO) return null;
  const paused = status === StudentStatus.PAUSADO;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold',
        paused ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {paused ? '⏸ Pausado' : 'Inativo'}
      {paused && pausedUntil && !compact ? ` · volta ${formatDateShort(pausedUntil, false)}` : ''}
    </span>
  );
}
