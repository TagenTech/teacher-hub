'use client';

import { displayName, LessonStatus, type LessonDto } from '@aulinha/contracts';
import { Check, MapPin, RefreshCw, Video, X } from 'lucide-react';
import * as React from 'react';
import { StudentAvatar } from '@/components/students/student-avatar';
import { timeOf } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { useTz } from '@/lib/use-tz';
import { cn, haptic } from '@/lib/utils';
import { useLessonActions } from './lesson-actions';
import { LessonStatusBadge } from './lesson-status';

const SWIPE = 84;

/**
 * Cartão de aula. Toque abre os detalhes; nas aulas a marcar:
 * botão ✓ (realizada, 1 toque), "Faltou", ou deslizar → realizada / ← falta.
 */
export function LessonCard({
  lesson,
  conflict,
  showDate,
  className,
}: {
  lesson: LessonDto;
  conflict?: boolean;
  showDate?: string;
  className?: string;
}) {
  const tz = useTz();
  const { openLesson, markDone } = useLessonActions();
  const now = useNow();
  const [dx, setDx] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const start = React.useRef<{ x: number; y: number; active: boolean } | null>(null);
  const moved = React.useRef(false);

  const markable = lesson.status === LessonStatus.AGENDADA && !!now && new Date(lesson.startsAt).getTime() < now + 12 * 3600_000;
  const dim = lesson.status === LessonStatus.CANCELADA || lesson.status === LessonStatus.REMARCADA;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!markable || e.pointerType === 'mouse') return;
    start.current = { x: e.clientX, y: e.clientY, active: false };
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const x = e.clientX - s.x;
    const y = e.clientY - s.y;
    if (!s.active) {
      if (Math.abs(y) > 12) {
        start.current = null;
        return;
      }
      if (Math.abs(x) > 12) {
        s.active = true;
        setDragging(true);
      }
    }
    if (s.active) {
      moved.current = true;
      setDx(Math.max(-140, Math.min(140, x)));
    }
  };
  const onPointerUp = () => {
    if (start.current?.active) {
      if (dx > SWIPE) markDone(lesson);
      else if (dx < -SWIPE) {
        haptic(10);
        openLesson(lesson.id, 'absence');
      }
    }
    start.current = null;
    setDragging(false);
    setDx(0);
  };

  return (
    <div className={cn('relative overflow-hidden rounded-3xl', className)}>
      {markable ? (
        <div aria-hidden className="absolute inset-0 flex items-center justify-between px-6 font-display font-extrabold">
          <span className={cn('flex items-center gap-2 text-success transition-opacity', dx > 20 ? 'opacity-100' : 'opacity-0')}>
            <Check className="size-6" strokeWidth={3} /> Realizada
          </span>
          <span className={cn('text-danger transition-opacity', dx < -20 ? 'opacity-100' : 'opacity-0')}>Faltou ✗</span>
        </div>
      ) : null}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !moved.current && openLesson(lesson.id)}
        onKeyDown={(e) => e.key === 'Enter' && openLesson(lesson.id)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform 220ms ease' }}
        className={cn(
          'relative flex touch-pan-y select-none items-center gap-3 border border-border bg-card p-3 pl-4 shadow-soft',
          'rounded-3xl',
          dx > 0 && 'bg-success-soft',
          dx < 0 && 'bg-danger-soft',
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-3 left-0 w-1.5 rounded-r-full"
          style={{ background: `var(--stu-${lesson.student.color}-fg)` }}
        />
        <div className={cn('w-12 shrink-0 text-center', dim && 'opacity-50')}>
          {showDate ? <p className="text-[11px] font-bold uppercase text-muted-foreground">{showDate}</p> : null}
          <p className="font-display text-lg font-black leading-tight tabular">{timeOf(lesson.startsAt, tz)}</p>
          <p className="text-xs text-muted-foreground tabular">{timeOf(lesson.endsAt, tz)}</p>
        </div>
        <StudentAvatar
          name={lesson.student.name}
          color={lesson.student.color}
          emoji={lesson.student.emoji}
          size="sm"
          className={cn(dim && 'opacity-50')}
        />
        <div className={cn('min-w-0 flex-1', dim && 'opacity-60')}>
          <p className={cn('truncate font-display font-extrabold', lesson.status === LessonStatus.CANCELADA && 'line-through')}>
            {displayName(lesson.student)}
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            {lesson.makeupCreditId ? <RefreshCw className="size-3 shrink-0" /> : null}
            {lesson.mode === 'ONLINE' ? <Video className="size-3 shrink-0" /> : <MapPin className="size-3 shrink-0" />}
            <span className="truncate">
              {lesson.makeupCreditId ? 'Reposição · ' : ''}
              {lesson.mode === 'ONLINE' ? 'Online' : (lesson.location ?? 'Presencial')}
            </span>
          </p>
          {conflict ? <p className="text-xs font-semibold text-warning">⚠︎ Horário em conflito</p> : null}
        </div>
        {markable ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-label={`Faltou: ${displayName(lesson.student)}`}
              onClick={(e) => {
                e.stopPropagation();
                haptic(8);
                openLesson(lesson.id, 'absence');
              }}
              className="grid size-10 place-items-center rounded-full bg-danger-soft text-danger-soft-foreground active:scale-90"
            >
              <X className="size-5" strokeWidth={3} />
            </button>
            <button
              type="button"
              aria-label={`Aula realizada: ${displayName(lesson.student)}`}
              onClick={(e) => {
                e.stopPropagation();
                markDone(lesson);
              }}
              className="grid size-10 place-items-center rounded-full bg-success text-white shadow-sm active:scale-90"
            >
              <Check className="size-5" strokeWidth={3} />
            </button>
          </div>
        ) : lesson.status !== LessonStatus.AGENDADA ? (
          <LessonStatusBadge status={lesson.status} justified={lesson.justified} short />
        ) : null}
      </div>
    </div>
  );
}
