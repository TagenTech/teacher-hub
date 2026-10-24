'use client';

import { formatDateShort } from '@turmei/contracts';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { FormTopBar, useBack } from '@/components/layout/form-page';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { SwitchRow } from '@/components/ui/switch-row';
import { ApiError } from '@/lib/api/client';
import { useBlocks, useCreateBlock, useRemoveBlock } from '@/lib/queries/agenda';
import { useToday } from '@/lib/use-today';
import { haptic } from '@/lib/utils';

const REASONS = ['Feriado', 'Folga', 'Férias', 'Viagem', 'Recesso'];

export default function BloqueiosPage() {
  const back = useBack('/mais');
  const today = useToday();
  const { data, isPending } = useBlocks();
  const create = useCreateBlock();
  const remove = useRemoveBlock();
  const [open, setOpen] = React.useState(false);
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  const [reason, setReason] = React.useState('Feriado');
  const [makeups, setMakeups] = React.useState(false);

  const openSheet = () => {
    setStart(today ?? '');
    setEnd(today ?? '');
    setReason('Feriado');
    setMakeups(false);
    setOpen(true);
  };

  return (
    <>
      <FormTopBar onBack={back} title="Bloqueios de agenda">
        <Button size="sm" variant="soft" onClick={openSheet}>
          <Plus className="!size-4" /> Novo
        </Button>
      </FormTopBar>
      <div className="px-5 pb-6">
        <p className="mb-4 px-1 text-muted-foreground">
          Feriados, folgas e férias. As aulas desses dias são canceladas de uma vez.
        </p>
        {isPending ? (
          <Skeleton className="h-32" />
        ) : !data?.length ? (
          <EmptyState
            emoji="🏖️"
            tone="peach"
            title="Nenhum bloqueio"
            description="Vai tirar uns dias? Bloqueie a agenda e avise os alunos."
            action={<Button onClick={openSheet}>Bloquear dias</Button>}
          />
        ) : (
          <div className="space-y-2.5">
            {data.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-3xl border border-border bg-card p-3.5 shadow-soft">
                <span className="grid size-11 place-items-center rounded-2xl bg-peach-soft">
                  <CalendarOff className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-extrabold">{b.reason}</p>
                  <p className="text-sm text-muted-foreground">
                    {b.startDate === b.endDate
                      ? formatDateShort(b.startDate)
                      : `${formatDateShort(b.startDate, false)} → ${formatDateShort(b.endDate)}`}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Remover bloqueio"
                  onClick={() =>
                    remove.mutate(b.id, { onSuccess: () => toast('Bloqueio removido — aulas de volta na agenda') })
                  }
                  className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
                >
                  <Trash2 className="size-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen} title="Bloquear dias">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <Chip key={r} active={reason === r} onClick={() => setReason(r)}>
                {r}
              </Chip>
            ))}
          </div>
          <Field label="Motivo" htmlFor="bl-reason">
            <Input id="bl-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="De" htmlFor="bl-start">
              <Input
                id="bl-start"
                type="date"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  if (!end || e.target.value > end) setEnd(e.target.value);
                }}
              />
            </Field>
            <Field label="Até" htmlFor="bl-end">
              <Input id="bl-end" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          <SwitchRow
            id="bl-makeups"
            checked={makeups}
            onCheckedChange={setMakeups}
            title="Gerar reposições"
            description="Os alunos ficam com crédito das aulas canceladas."
          />
          <Button
            block
            size="lg"
            loading={create.isPending}
            onClick={() =>
              create.mutate(
                { startDate: start, endDate: end, reason: reason.trim(), createMakeups: makeups },
                {
                  onSuccess: (r) => {
                    haptic(15);
                    toast.success(
                      r.canceled ? `${r.canceled} aula(s) cancelada(s) 🏖️` : 'Dias bloqueados — nenhuma aula afetada',
                    );
                    setOpen(false);
                  },
                  onError: (err) =>
                    toast.error(err instanceof ApiError ? (err.details?.[0] ?? err.message) : 'Não foi possível bloquear'),
                },
              )
            }
          >
            Bloquear
          </Button>
        </div>
      </Sheet>
    </>
  );
}
