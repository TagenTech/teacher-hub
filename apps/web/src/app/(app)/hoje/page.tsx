'use client';

import { addDays, displayName, LessonStatus, overlappingIds } from '@aulinha/contracts';
import { BellRing, CalendarClock, Check, ChevronRight, RefreshCw, UserRoundPlus, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { toast } from 'sonner';
import { LessonCard } from '@/components/agenda/lesson-card';
import { useLessonActions } from '@/components/agenda/lesson-actions';
import { AccountBanners } from '@/components/account/account-banners';
import { InstallCard } from '@/components/pwa/install-card';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { countdown, dateOf, timeOf } from '@/lib/format';
import { firstName, greeting, todayLabel } from '@/lib/greeting';
import { useLessons, useMakeups, usePendingLessons } from '@/lib/queries/agenda';
import { useStudents } from '@/lib/queries/students';
import { useNow } from '@/lib/use-now';
import { useToday } from '@/lib/use-today';
import { useTz } from '@/lib/use-tz';
import { cn } from '@/lib/utils';
import { FinanceHighlights } from './finance-highlights';

interface Step {
  icon: LucideIcon;
  title: string;
  text: string;
  tone: string;
  href?: string;
  onClick?: () => void;
  done?: boolean;
}

function StepRow({ step, index }: { step: Step; index: number }) {
  const { icon: Icon, title, text, tone, href, onClick, done } = step;
  const body = (
    <>
      <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', done ? 'bg-success-soft text-success-soft-foreground' : tone)}>
        {done ? <Check className="size-6" strokeWidth={3} /> : <Icon className="size-6" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('font-display font-extrabold', done && 'text-success-soft-foreground')}>
          {index + 1}. {title}
        </p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      <ChevronRight className="size-5 text-muted-foreground" />
    </>
  );
  const cls = 'flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-muted';
  return (
    <li>
      {href ? (
        <Link href={href} className={cls}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={cls}>
          {body}
        </button>
      )}
    </li>
  );
}

function Section({ title, action, children }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="animate-fade-up">
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="text-lg font-extrabold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function WelcomeToast() {
  const params = useSearchParams();
  const router = useRouter();
  const { teacher } = useAuth();
  React.useEffect(() => {
    if (params.get('bemvindo') && teacher) {
      toast.success(`Boas-vindas, ${firstName(teacher.name)}! 💜`);
      router.replace('/hoje');
    }
  }, [params, teacher, router]);
  return null;
}

export default function HojePage() {
  const { teacher } = useAuth();
  const tz = useTz();
  const today = useToday();
  const now = useNow();
  const { openNewLesson } = useLessonActions();
  const { data: students } = useStudents();
  const { data: lessonsToday, isPending } = useLessons(today ?? '', today ?? '', undefined, !!today);
  const { data: week } = useLessons(today ?? '', today ? addDays(today, 7) : '', undefined, !!today);
  const { data: pending } = usePendingLessons();
  const { data: makeups } = useMakeups({ status: 'ABERTO' });

  const hello = greeting(now ? new Date(now) : undefined);
  const list = (lessonsToday ?? []).filter((l) => l.status !== LessonStatus.REMARCADA);
  const active = list.filter((l) => l.status !== LessonStatus.CANCELADA);
  const done = active.filter((l) => l.status !== LessonStatus.AGENDADA).length;
  const next = (week ?? []).find((l) => l.status === LessonStatus.AGENDADA && new Date(l.endsAt).getTime() > now);
  const pendingPast = (pending ?? []).filter((l) => !today || dateOf(l.startsAt, tz) !== today);
  const conflicts = React.useMemo(() => overlappingIds(list), [list]);

  const studentCount = students?.length ?? 0;
  const hasAgenda = (week?.length ?? 0) > 0;
  const steps: Step[] = [
    {
      icon: UserRoundPlus,
      title: studentCount ? `${studentCount} ${studentCount === 1 ? 'aluno' : 'alunos'} cadastrados` : 'Cadastre seus alunos',
      text: 'Contato, valor da aula e dia do pagamento.',
      tone: 'bg-pink-soft text-pink-soft-foreground',
      href: studentCount ? '/alunos' : '/alunos/novo',
      done: studentCount > 0,
    },
    {
      icon: CalendarClock,
      title: 'Monte sua agenda',
      text: 'Horários fixos viram aulas automaticamente.',
      tone: 'bg-primary-soft text-primary-soft-foreground',
      onClick: () => openNewLesson({ weekly: true }),
      done: hasAgenda,
    },
    {
      icon: BellRing,
      title: 'Ative os lembretes',
      text: 'Alarme antes da aula e aviso de pagamento.',
      tone: 'bg-warning-soft text-warning-soft-foreground',
      href: '/mais/lembretes',
    },
  ];
  const onboarding = students && week && (!studentCount || !hasAgenda);

  return (
    <div className="space-y-6 px-5 pt-6">
      <Suspense>
        <WelcomeToast />
      </Suspense>
      <header className="animate-fade-up">
        <p className="text-sm font-medium text-muted-foreground">{now ? todayLabel(new Date(now)) : ' '}</p>
        <h1 className="text-3xl font-black">
          {hello.text}, {teacher ? firstName(teacher.name) : ''} {hello.emoji}
        </h1>
      </header>

      <section className="relative animate-fade-up overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#8f7cf8] via-[#a98bf3] to-[#f28db8] p-6 text-white shadow-float">
        <div aria-hidden className="absolute -bottom-12 -right-8 size-44 rounded-full bg-white/15" />
        {isPending || !today ? (
          <div className="h-24" />
        ) : active.length ? (
          <>
            <p className="font-display text-sm font-bold uppercase tracking-wider text-white/80">Hoje</p>
            <p className="mt-1 font-display text-4xl font-black">
              {active.length} {active.length === 1 ? 'aula' : 'aulas'}
            </p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/25" aria-hidden>
              <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${(done / active.length) * 100}%` }} />
            </div>
            <p className="mt-2 text-white/90">
              {done === active.length ? 'Tudo marcado por hoje! 🎉' : `${done} de ${active.length} marcadas`}
              {next && dateOf(next.startsAt, tz) === today
                ? ` · próxima: ${displayName(next.student)} ${countdown(next.startsAt, now)}`
                : ''}
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-sm font-bold uppercase tracking-wider text-white/80">Hoje</p>
            <h2 className="mt-1 text-2xl font-black leading-tight">Dia livre de aulas ☕</h2>
            <p className="mt-2 max-w-[18rem] text-white/90">
              {next ? `Próxima: ${displayName(next.student)} ${countdown(next.startsAt, now)}.` : 'Aproveite para descansar ou planejar.'}
            </p>
          </>
        )}
      </section>


      {pendingPast.length ? (
        <Section
          title={
            <>
              Falta marcar <span className="ml-1 rounded-full bg-warning-soft px-2 py-0.5 text-sm text-warning-soft-foreground">{pendingPast.length}</span>
            </>
          }
        >
          <p className="-mt-1 mb-2.5 px-1 text-sm text-muted-foreground">Toque ✓ se a aula aconteceu ou deslize para o lado.</p>
          <div className="space-y-2">
            {pendingPast.slice(0, 6).map((l) => (
              <LessonCard key={l.id} lesson={l} showDate={dateOf(l.startsAt, tz).slice(8) + '/' + dateOf(l.startsAt, tz).slice(5, 7)} />
            ))}
          </div>
          {pendingPast.length > 6 ? (
            <Link href="/agenda" className="mt-2 block text-center text-sm font-semibold text-primary">
              Ver todas na agenda
            </Link>
          ) : null}
        </Section>
      ) : null}

      <AccountBanners />

      <FinanceHighlights />

      {list.length ? (
        <Section title="Aulas de hoje" action={<Link href="/agenda" className="text-sm font-semibold text-primary">Agenda</Link>}>
          <div className="space-y-2">
            {list.map((l) => (
              <LessonCard key={l.id} lesson={l} conflict={conflicts.has(l.id)} />
            ))}
          </div>
        </Section>
      ) : isPending ? (
        <Skeleton className="h-24 rounded-3xl" />
      ) : null}

      {makeups?.length ? (
        <Link
          href="/mais/reposicoes"
          className="flex animate-fade-up items-center gap-4 rounded-3xl bg-sky-soft p-4"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-card text-[var(--stu-ceu-fg)] shadow-soft">
            <RefreshCw className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-extrabold">
              {makeups.length} {makeups.length === 1 ? 'reposição' : 'reposições'} para agendar
            </span>
            <span className="text-sm text-muted-foreground">Toque para escolher os horários.</span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
      ) : null}

      <InstallCard />

      {onboarding ? (
        <Section title="Primeiros passos">
          <Card className="p-2">
            <ol>
              {steps.map((step, i) => (
                <StepRow key={i} step={step} index={i} />
              ))}
            </ol>
          </Card>
        </Section>
      ) : null}

      {next && !active.length && today ? (
        <p className="pb-2 text-center text-sm text-muted-foreground">
          Próxima aula: {displayName(next.student)} · {dateOf(next.startsAt, tz) === addDays(today, 1) ? 'amanhã' : dateOf(next.startsAt, tz).split('-').reverse().slice(0, 2).join('/')} às {timeOf(next.startsAt, tz)}
        </p>
      ) : null}
    </div>
  );
}
