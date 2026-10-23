'use client';

import { displayName, formatDateShort } from '@aulinha/contracts';
import { toast } from 'sonner';
import { useLessonActions } from '@/components/agenda/lesson-actions';
import { FormTopBar, useBack } from '@/components/layout/form-page';
import { StudentAvatar } from '@/components/students/student-avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { dateOf } from '@/lib/format';
import { useCancelMakeup, useMakeups } from '@/lib/queries/agenda';
import { useTz } from '@/lib/use-tz';

export default function ReposicoesPage() {
  const back = useBack('/mais');
  const tz = useTz();
  const { data, isPending } = useMakeups({ status: 'ABERTO' });
  const { openNewLesson } = useLessonActions();
  const cancel = useCancelMakeup();

  return (
    <>
      <FormTopBar onBack={back} title="Reposições" />
      <div className="px-5 pb-6">
        <p className="mb-4 px-1 text-muted-foreground">
          Aulas que você deve aos alunos: faltas suas, faltas justificadas e feriados.
        </p>
        {isPending ? (
          <Skeleton className="h-40" />
        ) : !data?.length ? (
          <EmptyState emoji="🔁" tone="sky" title="Tudo em dia" description="Nenhuma reposição pendente. 🎉" />
        ) : (
          <div className="space-y-2.5">
            {data.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-3xl border border-border bg-card p-3.5 shadow-soft">
                <StudentAvatar name={m.student.name} color={m.student.color} emoji={m.student.emoji} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-extrabold">{displayName(m.student)}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {m.originStartsAt ? `Aula de ${formatDateShort(dateOf(m.originStartsAt, tz), false)}` : 'Crédito'}
                    {m.reason ? ` · ${m.reason}` : ''}
                  </p>
                </div>
                <Button size="sm" onClick={() => openNewLesson({ makeup: m })}>
                  Agendar
                </Button>
                <button
                  type="button"
                  onClick={() => cancel.mutate(m.id, { onSuccess: () => toast('Reposição descartada') })}
                  className="text-xs font-semibold text-muted-foreground underline"
                >
                  Descartar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
