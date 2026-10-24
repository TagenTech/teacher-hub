import { LESSON_STATUS_LABEL, LessonStatus } from '@turmei/contracts';
import { cn } from '@/lib/utils';

const TONE: Record<LessonStatus, string> = {
  AGENDADA: 'bg-primary-soft text-primary-soft-foreground',
  REALIZADA: 'bg-success-soft text-success-soft-foreground',
  FALTA_ALUNO: 'bg-danger-soft text-danger-soft-foreground',
  FALTA_PROFESSOR: 'bg-warning-soft text-warning-soft-foreground',
  CANCELADA: 'bg-muted text-muted-foreground',
  REMARCADA: 'bg-muted text-muted-foreground',
};

const EMOJI: Record<LessonStatus, string> = {
  AGENDADA: '🗓️',
  REALIZADA: '✓',
  FALTA_ALUNO: '✗',
  FALTA_PROFESSOR: '⚠︎',
  CANCELADA: '⊘',
  REMARCADA: '↪',
};

const SHORT: Record<LessonStatus, string> = {
  AGENDADA: 'Agendada',
  REALIZADA: 'Feita',
  FALTA_ALUNO: 'Faltou',
  FALTA_PROFESSOR: 'Eu faltei',
  CANCELADA: 'Cancelada',
  REMARCADA: 'Remarcada',
};

export function LessonStatusBadge({
  status,
  justified,
  short,
  className,
}: {
  status: LessonStatus;
  justified?: boolean;
  /** Rótulo curto (cartões). */
  short?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold',
        TONE[status],
        className,
      )}
    >
      <span aria-hidden>{EMOJI[status]}</span>
      {status === LessonStatus.FALTA_ALUNO && justified
        ? short
          ? 'Justificada'
          : 'Falta justificada'
        : short
          ? SHORT[status]
          : LESSON_STATUS_LABEL[status]}
    </span>
  );
}
