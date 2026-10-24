'use client';

import {
  addDays,
  addMonths,
  firstDayOf,
  lastDayOf,
  monthLabel,
  monthOf,
  overlappingIds,
  startOfWeek,
  WEEKDAYS,
  WEEKDAYS_SHORT,
  type IsoDate,
  type LessonDto,
} from '@turmei/contracts';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { LessonCard } from '@/components/agenda/lesson-card';
import { useLessonActions } from '@/components/agenda/lesson-actions';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { capitalize, dateOf } from '@/lib/format';
import { useLessons } from '@/lib/queries/agenda';
import { useHydrated } from '@/lib/use-hydrated';
import { useToday } from '@/lib/use-today';
import { useTz } from '@/lib/use-tz';
import { cn, haptic } from '@/lib/utils';

type View = 'dia' | 'semana' | 'mes';
const VIEWS: { v: View; l: string }[] = [
  { v: 'dia', l: 'Dia' },
  { v: 'semana', l: 'Semana' },
  { v: 'mes', l: 'Mês' },
];
const VIEW_KEY = 'turmei_agenda_view';

function savedView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === 'semana' || v === 'mes' ? v : 'dia';
  } catch {
    return 'dia';
  }
}

function useGrouped(lessons: LessonDto[] | undefined, tz: string) {
  return React.useMemo(() => {
    const map = new Map<IsoDate, LessonDto[]>();
    for (const l of lessons ?? []) {
      const d = dateOf(l.startsAt, tz);
      map.set(d, [...(map.get(d) ?? []), l]);
    }
    return map;
  }, [lessons, tz]);
}

function DayList({ lessons, date, today }: { lessons: LessonDto[]; date: IsoDate; today: IsoDate }) {
  const { openNewLesson } = useLessonActions();
  const conflicts = React.useMemo(() => overlappingIds(lessons), [lessons]);
  if (!lessons.length) {
    return (
      <EmptyState
        emoji={date < today ? '🍃' : '☕'}
        tone="peach"
        title={date === today ? 'Dia livre hoje' : 'Nenhuma aula'}
        description={date < today ? 'Nada aconteceu por aqui.' : 'Que tal aproveitar ou agendar uma aula?'}
        action={
          date >= today ? (
            <Button variant="soft" onClick={() => openNewLesson({ date })}>
              <CalendarPlus /> Agendar neste dia
            </Button>
          ) : undefined
        }
        className="py-8"
      />
    );
  }
  return (
    <div className="space-y-2.5">
      {lessons.map((l) => (
        <LessonCard key={l.id} lesson={l} conflict={conflicts.has(l.id)} />
      ))}
    </div>
  );
}

export default function AgendaPage() {
  const tz = useTz();
  const today = useToday();
  const { openNewLesson } = useLessonActions();
  const hydrated = useHydrated();
  const [picked, setViewState] = React.useState<View | null>(null);
  const view = picked ?? (hydrated ? savedView() : 'dia');
  const [selected, setSelected] = React.useState<IsoDate | null>(null);
  const day = selected ?? today;

  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignora */
    }
  };

  const weekStart = day ? startOfWeek(day) : null;
  const month = day ? monthOf(day) : null;
  const gridStart = month ? startOfWeek(firstDayOf(month)) : null;
  const gridEnd = month ? addDays(startOfWeek(lastDayOf(month)), 6) : null;

  const [from, to] =
    view === 'mes' ? [gridStart, gridEnd] : weekStart ? [weekStart, addDays(weekStart, 6)] : [null, null];
  const { data, isPending } = useLessons(from ?? '', to ?? '', undefined, !!from && !!to);
  const grouped = useGrouped(data, tz);

  if (!day || !today || !weekStart || !month || !gridStart) {
    return <Skeleton className="m-5 h-96" />;
  }

  const shift = (dir: 1 | -1) => {
    haptic(6);
    if (view === 'mes') setSelected(firstDayOf(addMonths(month, dir)));
    else setSelected(addDays(day, (view === 'dia' ? 1 : 7) * dir));
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <>
      <header className="flex items-end justify-between gap-3 px-5 pb-3 pt-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{capitalize(monthLabel(month))}</p>
          <h1 className="text-3xl font-black">Agenda</h1>
        </div>
        <div className="flex items-center gap-2">
          {day !== today ? (
            <Button size="sm" variant="soft" onClick={() => setSelected(today)}>
              Hoje
            </Button>
          ) : null}
          <Button size="icon" variant="soft" aria-label="Nova aula" onClick={() => openNewLesson({ date: day >= today ? day : today })}>
            <CalendarPlus />
          </Button>
        </div>
      </header>

      <div className="sticky top-0 z-20 space-y-3 bg-background/90 px-5 pb-3 pt-1 backdrop-blur-lg">
        <div role="tablist" aria-label="Visualização" className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1.5">
          {VIEWS.map((v) => (
            <button
              key={v.v}
              role="tab"
              type="button"
              aria-selected={view === v.v}
              onClick={() => setView(v.v)}
              className={cn(
                'rounded-xl py-2 text-sm font-bold transition-all',
                view === v.v ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground',
              )}
            >
              {v.l}
            </button>
          ))}
        </div>

        {view !== 'mes' ? (
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Semana anterior" onClick={() => setSelected(addDays(day, -7))} className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted">
              <ChevronLeft className="size-5" />
            </button>
            <div className="grid flex-1 grid-cols-7 gap-1">
              {weekDays.map((d) => {
                const count = grouped.get(d)?.filter((l) => l.status !== 'REMARCADA' && l.status !== 'CANCELADA').length ?? 0;
                const active = d === day;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      haptic(5);
                      setSelected(d);
                      if (view === 'semana') document.getElementById(`dia-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    aria-label={`${WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]} ${Number(d.slice(8))}, ${count} aulas`}
                    aria-pressed={active}
                    className={cn(
                      'flex flex-col items-center rounded-2xl py-1.5 transition-all',
                      active ? 'bg-primary text-primary-foreground shadow-float' : d === today ? 'bg-primary-soft text-primary-soft-foreground' : 'hover:bg-muted',
                    )}
                  >
                    <span className={cn('text-[11px] font-bold uppercase', active ? 'opacity-90' : 'text-muted-foreground')}>
                      {WEEKDAYS_SHORT[new Date(`${d}T00:00:00Z`).getUTCDay()]}
                    </span>
                    <span className="font-display text-lg font-black tabular">{Number(d.slice(8))}</span>
                    <span className="flex h-1.5 gap-0.5">
                      {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                        <span key={i} className={cn('size-1.5 rounded-full', active ? 'bg-primary-foreground' : 'bg-primary')} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            <button type="button" aria-label="Próxima semana" onClick={() => setSelected(addDays(day, 7))} className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted">
              <ChevronRight className="size-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button type="button" aria-label="Mês anterior" onClick={() => shift(-1)} className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted">
              <ChevronLeft className="size-5" />
            </button>
            <p className="font-display text-lg font-extrabold">{capitalize(monthLabel(month))}</p>
            <button type="button" aria-label="Próximo mês" onClick={() => shift(1)} className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted">
              <ChevronRight className="size-5" />
            </button>
          </div>
        )}
      </div>

      <div className="px-5 pb-4">
        {isPending && !data ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-3xl" />
            ))}
          </div>
        ) : view === 'dia' ? (
          <div key={day} className="animate-fade-up">
            <h2 className="mb-3 px-1 font-display text-lg font-extrabold">
              {day === today ? 'Hoje' : capitalize(WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()])}, {Number(day.slice(8))} de {monthLabel(month, false)}
            </h2>
            <DayList lessons={grouped.get(day) ?? []} date={day} today={today} />
          </div>
        ) : view === 'semana' ? (
          <div className="space-y-5">
            {weekDays.map((d) => {
              const list = grouped.get(d) ?? [];
              return (
                <section key={d} id={`dia-${d}`} className="scroll-mt-48">
                  <h2 className={cn('mb-2 flex items-center gap-2 px-1 font-display font-extrabold', d === today && 'text-primary-soft-foreground')}>
                    {capitalize(WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()])} {Number(d.slice(8))}
                    {d === today ? <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs">hoje</span> : null}
                  </h2>
                  {list.length ? (
                    <div className="space-y-2">
                      {list.map((l) => (
                        <LessonCard key={l.id} lesson={l} />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">Livre</p>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <MonthGrid
            gridStart={gridStart}
            month={month}
            today={today}
            selected={day}
            grouped={grouped}
            onSelect={(d) => {
              haptic(5);
              setSelected(d);
            }}
          />
        )}
        {view === 'mes' ? (
          <div key={day} className="mt-5 animate-fade-up">
            <h2 className="mb-3 px-1 font-display text-lg font-extrabold">
              {day === today ? 'Hoje' : `${capitalize(WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()])}, ${Number(day.slice(8))}`}
            </h2>
            <DayList lessons={grouped.get(day) ?? []} date={day} today={today} />
          </div>
        ) : null}
      </div>
    </>
  );
}

function MonthGrid({
  gridStart,
  month,
  today,
  selected,
  grouped,
  onSelect,
}: {
  gridStart: IsoDate;
  month: string;
  today: IsoDate;
  selected: IsoDate;
  grouped: Map<IsoDate, LessonDto[]>;
  onSelect: (d: IsoDate) => void;
}) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)).filter(
    (d, i) => i < 35 || monthOf(addDays(gridStart, 35)) === month,
  );
  return (
    <div className="rounded-3xl border border-border bg-card p-2 shadow-soft">
      <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-bold uppercase text-muted-foreground">
        {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d) => {
          const list = (grouped.get(d) ?? []).filter((l) => l.status !== 'REMARCADA');
          const inMonth = monthOf(d) === month;
          const active = d === selected;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d)}
              aria-label={`Dia ${Number(d.slice(8))}, ${list.length} aulas`}
              aria-pressed={active}
              className={cn(
                'flex aspect-square flex-col items-center justify-start gap-1 rounded-xl pt-1.5 transition-all',
                active ? 'bg-primary text-primary-foreground' : d === today ? 'bg-primary-soft' : 'hover:bg-muted',
                !inMonth && !active && 'opacity-35',
              )}
            >
              <span className="text-sm font-bold tabular">{Number(d.slice(8))}</span>
              <span className="flex flex-wrap justify-center gap-0.5 px-1">
                {list.slice(0, 4).map((l) => (
                  <span
                    key={l.id}
                    className="size-1.5 rounded-full"
                    style={{ background: active ? 'currentColor' : `var(--stu-${l.student.color}-fg)`, opacity: l.status === 'CANCELADA' ? 0.35 : 1 }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
