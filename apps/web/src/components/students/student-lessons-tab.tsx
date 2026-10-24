'use client';

import {
  addDays,
  formatDateShort,
  formatDuration,
  LessonStatus,
  StudentStatus,
  WEEKDAYS,
  type SlotDto,
  type StudentDetailDto,
} from '@turmei/contracts';
import { CalendarPlus, ChevronRight, MapPin, Plus, RefreshCw, Video } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { LessonCard } from '@/components/agenda/lesson-card';
import { useLessonActions } from '@/components/agenda/lesson-actions';
import { SlotSheet } from '@/components/agenda/slot-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { dateOf } from '@/lib/format';
import { useCancelMakeup, useLessons, useMakeups, useSlots } from '@/lib/queries/agenda';
import { useTz } from '@/lib/use-tz';

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{children}</h3>
      {action}
    </div>
  );
}

export function StudentLessonsTab({ student, today }: { student: StudentDetailDto; today: string }) {
  const tz = useTz();
  const { openNewLesson } = useLessonActions();
  const { data: slots, isPending: loadingSlots } = useSlots(student.id);
  const { data: upcoming } = useLessons(today, addDays(today, 28), student.id);
  const { data: history } = useLessons(addDays(today, -60), addDays(today, -1), student.id);
  const { data: makeups } = useMakeups({ studentId: student.id, status: 'ABERTO' });
  const cancelMakeup = useCancelMakeup();
  const [editing, setEditing] = React.useState<SlotDto | null>(null);
  const inactive = student.status === StudentStatus.INATIVO;

  const next = (upcoming ?? []).filter((l) => l.status !== LessonStatus.REMARCADA).slice(0, 5);
  const past = [...(history ?? [])].reverse().filter((l) => l.status !== LessonStatus.REMARCADA);
  const stats = past.reduce(
    (a, l) => {
      if (l.status === LessonStatus.REALIZADA) a.done++;
      else if (l.status === LessonStatus.FALTA_ALUNO) a.missed++;
      return a;
    },
    { done: 0, missed: 0 },
  );

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle
          action={
            !inactive ? (
              <Button size="sm" variant="ghost" onClick={() => openNewLesson({ studentId: student.id, weekly: true })}>
                <Plus className="!size-4" /> Horário
              </Button>
            ) : null
          }
        >
          Horários fixos
        </SectionTitle>
        {loadingSlots ? (
          <Skeleton className="h-20" />
        ) : slots?.length ? (
          <Card className="p-1.5">
            {slots.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setEditing(s)}
                className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-muted"
              >
                <span
                  className="grid size-12 shrink-0 place-items-center rounded-2xl font-display text-sm font-black uppercase"
                  style={{ background: `var(--stu-${student.color})`, color: `var(--stu-${student.color}-fg)` }}
                >
                  {WEEKDAYS[s.weekday].slice(0, 3)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display font-extrabold">
                    Toda {WEEKDAYS[s.weekday]} · {s.startTime}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    {s.mode === 'ONLINE' ? <Video className="size-3.5" /> : <MapPin className="size-3.5" />}
                    {formatDuration(s.durationMin)} · {s.mode === 'ONLINE' ? 'Online' : (s.location ?? 'Presencial')}
                    {s.validFrom > today ? ` · começa ${formatDateShort(s.validFrom, false)}` : ''}
                    {s.validTo ? ` · até ${formatDateShort(s.validTo, false)}` : ''}
                  </span>
                </span>
                <ChevronRight className="size-5 text-muted-foreground" />
              </button>
            ))}
          </Card>
        ) : (
          <button
            type="button"
            disabled={inactive}
            onClick={() => openNewLesson({ studentId: student.id, weekly: true })}
            className="flex w-full items-center gap-3 rounded-3xl border-2 border-dashed border-border p-4 text-left text-muted-foreground hover:bg-muted disabled:opacity-60"
          >
            <CalendarPlus className="size-6" />
            <span>
              <span className="block font-semibold text-foreground">Nenhum horário fixo</span>
              <span className="text-sm">Toque para criar — as aulas aparecem sozinhas na agenda.</span>
            </span>
          </button>
        )}
      </section>

      {makeups?.length ? (
        <section>
          <SectionTitle>Reposições a agendar</SectionTitle>
          <div className="space-y-2">
            {makeups.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-3xl bg-sky-soft p-3.5">
                <RefreshCw className="size-5 shrink-0 text-[var(--stu-ceu-fg)]" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    Aula de {m.originStartsAt ? formatDateShort(dateOf(m.originStartsAt, tz), false) : 'antes'}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{m.reason ?? 'Sem motivo'}</p>
                </div>
                <Button size="sm" onClick={() => openNewLesson({ makeup: m })}>
                  Agendar
                </Button>
                <button
                  type="button"
                  className="text-xs font-semibold text-muted-foreground underline"
                  onClick={() =>
                    cancelMakeup.mutate(m.id, { onSuccess: () => toast('Reposição descartada') })
                  }
                >
                  Descartar
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionTitle
          action={
            !inactive ? (
              <Button size="sm" variant="ghost" onClick={() => openNewLesson({ studentId: student.id })}>
                <Plus className="!size-4" /> Avulsa
              </Button>
            ) : null
          }
        >
          Próximas aulas
        </SectionTitle>
        {next.length ? (
          <div className="space-y-2">
            {next.map((l) => (
              <LessonCard key={l.id} lesson={l} showDate={formatDateShort(dateOf(l.startsAt, tz), false)} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            Nada agendado nas próximas 4 semanas.
          </p>
        )}
      </section>

      {past.length ? (
        <section>
          <SectionTitle>
            Últimos 60 dias · {stats.done} feitas{stats.missed ? ` · ${stats.missed} faltas` : ''}
          </SectionTitle>
          <div className="space-y-2">
            {past.slice(0, 12).map((l) => (
              <LessonCard key={l.id} lesson={l} showDate={formatDateShort(dateOf(l.startsAt, tz), false)} />
            ))}
          </div>
        </section>
      ) : null}

      <SlotSheet slot={editing} today={today} onClose={() => setEditing(null)} />
    </div>
  );
}
