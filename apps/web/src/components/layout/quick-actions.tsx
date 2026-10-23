'use client';

import { CalendarPlus, ChevronRight, HandCoins, Plus, Receipt, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as React from 'react';
import { useLessonActions } from '@/components/agenda/lesson-actions';
import { useFinanceActions } from '@/components/finance/finance-actions';
import { Sheet } from '@/components/ui/sheet';
import { haptic } from '@/lib/utils';

const ACTIONS: { icon: typeof Plus; label: string; tone: string; href?: string; action?: 'lesson' | 'charge' | 'payment' }[] = [
  { icon: CalendarPlus, label: 'Nova aula', tone: 'bg-primary-soft text-primary-soft-foreground', action: 'lesson' },
  { icon: UserPlus, label: 'Novo aluno', tone: 'bg-pink-soft text-pink-soft-foreground', href: '/alunos/novo' },
  { icon: HandCoins, label: 'Registrar pagamento', tone: 'bg-success-soft text-success-soft-foreground', action: 'payment' },
  { icon: Receipt, label: 'Nova cobrança avulsa', tone: 'bg-warning-soft text-warning-soft-foreground', action: 'charge' },
];

/** Botão flutuante "+" com os atalhos mais usados. Os que ainda não existem aparecem como "Em breve". */
export function QuickActions() {
  const [open, setOpen] = React.useState(false);
  const { openNewLesson } = useLessonActions();
  const { openNewCharge } = useFinanceActions();
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptic(10);
          setOpen(true);
        }}
        aria-label="Ações rápidas"
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-5 z-40 grid size-15 place-items-center rounded-[1.4rem] bg-gradient-to-br from-[#8f7cf8] to-[#f28db8] text-white shadow-float transition-transform active:scale-90"
      >
        <Plus className="size-7" strokeWidth={2.6} />
      </button>

      <Sheet open={open} onOpenChange={setOpen} title="O que vamos fazer?">
        <ul className="grid gap-3">
          {ACTIONS.map(({ icon: Icon, label, tone, href, action }) => {
            const body = (
              <>
                <span className={`grid size-12 place-items-center rounded-2xl ${tone}`}>
                  <Icon className="size-6" />
                </span>
                <span className="flex-1 font-display text-lg font-bold">{label}</span>
                {href || action ? (
                  <ChevronRight className="size-5 text-muted-foreground" />
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    Em breve
                  </span>
                )}
              </>
            );
            return (
              <li key={label}>
                {href ? (
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-4 rounded-2xl border border-border p-3.5 transition-colors hover:bg-muted active:scale-[0.98]"
                  >
                    {body}
                  </Link>
                ) : action ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (action === 'lesson') openNewLesson();
                      else if (action === 'charge') openNewCharge();
                      else router.push('/financeiro?status=abertas');
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl border border-border p-3.5 text-left transition-colors hover:bg-muted active:scale-[0.98]"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="flex items-center gap-4 rounded-2xl border border-border p-3.5 opacity-70">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
