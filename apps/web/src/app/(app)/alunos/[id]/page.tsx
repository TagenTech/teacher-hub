'use client';

import {
  ageOn,
  describePlan,
  displayName,
  formatDateLong,
  formatDateShort,
  dialNumber,
  formatPhone,
  StudentStatus,
  whatsappLink,
  type StudentDetailDto,
} from '@turmei/contracts';
import {
  Archive,
  Cake,
  EllipsisVertical,
  Mail,
  MessageCircle,
  Pause,
  Pencil,
  Phone,
  Play,
  ShieldCheck,
  Sprout,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { FormTopBar, useBack } from '@/components/layout/form-page';
import { ChangePlanSheet } from '@/components/students/change-plan-sheet';
import { DeleteStudentSheet } from '@/components/students/delete-sheet';
import { PauseSheet } from '@/components/students/pause-sheet';
import { StudentFinanceTab } from '@/components/students/student-finance-tab';
import { StudentStatusBadge } from '@/components/students/status-badge';
import { StudentAvatar } from '@/components/students/student-avatar';
import { StudentLessonsTab } from '@/components/students/student-lessons-tab';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { useChangeStudentStatus, useStudent, useUpdateStudent } from '@/lib/queries/students';
import { useToday } from '@/lib/use-today';
import { cn, haptic } from '@/lib/utils';

type Tab = 'resumo' | 'aulas' | 'financeiro' | 'notas';
const TABS: { value: Tab; label: string }[] = [
  { value: 'resumo', label: 'Resumo' },
  { value: 'aulas', label: 'Aulas' },
  { value: 'financeiro', label: 'Pagam.' },
  { value: 'notas', label: 'Notas' },
];

function InfoRow({ icon: Icon, label, value, href }: { icon: LucideIcon; label: string; value: string; href?: string }) {
  const content = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-muted-foreground">{label}</span>
        <span className="block truncate font-semibold">{value}</span>
      </span>
    </>
  );
  return href ? (
    <a href={href} className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-muted">
      {content}
    </a>
  ) : (
    <div className="flex items-center gap-3 p-2.5">{content}</div>
  );
}

function SummaryTab({ s, today }: { s: StudentDetailDto; today: string }) {
  const birthday = s.birthDate
    ? `${formatDateLong(s.birthDate, false)} · ${ageOn(s.birthDate, today)} anos`
    : null;
  const isBirthday = s.birthDate?.slice(5) === today.slice(5);
  return (
    <div className="space-y-5">
      {isBirthday ? (
        <div className="animate-pop-in rounded-3xl bg-pink-soft p-4 text-center font-display font-extrabold text-pink-soft-foreground">
          🎂 Hoje é aniversário de {displayName(s)}!
        </div>
      ) : null}
      <Card className="p-2">
        {s.phone ? (
          <InfoRow icon={Phone} label="WhatsApp" value={formatPhone(s.phone)} href={whatsappLink(s.phone)} />
        ) : null}
        {s.email ? <InfoRow icon={Mail} label="E-mail" value={s.email} href={`mailto:${s.email}`} /> : null}
        {birthday ? <InfoRow icon={Cake} label="Aniversário" value={birthday} /> : null}
        <InfoRow icon={Sprout} label="Aluno desde" value={formatDateLong(s.startDate)} />
        {s.guardianName ? (
          <InfoRow
            icon={ShieldCheck}
            label={s.payerIsGuardian ? 'Responsável · paga as aulas' : 'Responsável'}
            value={s.guardianPhone ? `${s.guardianName} · ${formatPhone(s.guardianPhone)}` : s.guardianName}
            href={s.guardianPhone ? whatsappLink(s.guardianPhone) : undefined}
          />
        ) : null}
      </Card>
      {s.tags.length ? (
        <div className="flex flex-wrap gap-2">
          {s.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary-soft-foreground"
            >
              #{t}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NotesTab({ s }: { s: StudentDetailDto }) {
  const update = useUpdateStudent(s.id);
  const [notes, setNotes] = React.useState(s.notes ?? '');
  const dirty = notes.trim() !== (s.notes ?? '');
  return (
    <div className="space-y-3">
      <Textarea
        aria-label="Anotações"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Objetivos, repertório, o que funcionou na última aula…"
        className="min-h-56"
      />
      <Button
        block
        disabled={!dirty}
        loading={update.isPending}
        onClick={async () => {
          try {
            await update.mutateAsync({ notes: notes.trim() || null });
            haptic(12);
            toast.success('Anotações salvas 📝');
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar');
          }
        }}
      >
        Salvar anotações
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Em breve: anotações por aula, com o que foi ensinado e a tarefa.
      </p>
    </div>
  );
}

export default function AlunoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const back = useBack('/alunos');
  const today = useToday();
  const { data: s, isPending, isError } = useStudent(id);
  const changeStatus = useChangeStudentStatus(id);
  const [tab, setTab] = React.useState<Tab>('resumo');
  const [sheet, setSheet] = React.useState<'plan' | 'pause' | 'delete' | null>(null);

  if (isPending || !today) {
    return (
      <div className="space-y-5 p-5">
        <Skeleton className="h-10 w-10" />
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="size-24 rounded-[2rem]" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-12" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (isError || !s) {
    return (
      <>
        <FormTopBar onBack={back} />
        <EmptyState
          emoji="🫥"
          tone="sky"
          title="Aluno não encontrado"
          description="Ele pode ter sido excluído."
          action={
            <Button asChild>
              <Link href="/alunos">Ver alunos</Link>
            </Button>
          }
        />
      </>
    );
  }

  const name = displayName(s);
  const setStatus = async (status: StudentStatus, msg: string) => {
    try {
      await changeStatus.mutateAsync({ status });
      haptic(15);
      toast.success(msg);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível alterar');
    }
  };
  // Atalhos falam com o aluno; sem telefone dele, com o responsável.
  const contactPhone = s.phone ?? s.guardianPhone;

  return (
    <>
      <FormTopBar onBack={back}>
        <span className="flex-1" />
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label="Mais ações"
              className="grid size-11 place-items-center rounded-2xl hover:bg-muted"
            >
              <EllipsisVertical className="size-6" />
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<Pencil />} onSelect={() => router.push(`/alunos/${s.id}/editar`)}>
              Editar ficha
            </MenuItem>
            {s.status === StudentStatus.ATIVO ? (
              <MenuItem icon={<Pause />} onSelect={() => setSheet('pause')}>
                Pausar
              </MenuItem>
            ) : (
              <MenuItem icon={<Play />} onSelect={() => setStatus(StudentStatus.ATIVO, `${name} está ativo de novo 🌱`)}>
                Reativar
              </MenuItem>
            )}
            {s.status !== StudentStatus.INATIVO ? (
              <MenuItem
                icon={<Archive />}
                onSelect={() => setStatus(StudentStatus.INATIVO, `${name} foi arquivado`)}
              >
                Arquivar
              </MenuItem>
            ) : null}
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} danger onSelect={() => setSheet('delete')}>
              Excluir
            </MenuItem>
          </MenuContent>
        </Menu>
      </FormTopBar>

      <div className="px-5">
        <header className="flex animate-fade-up flex-col items-center pb-5 pt-1 text-center">
          <StudentAvatar name={s.name} color={s.color} emoji={s.emoji} size="xl" className="shadow-soft" />
          <h1 className="mt-4 text-3xl font-black">{name}</h1>
          {name !== s.name ? <p className="text-muted-foreground">{s.name}</p> : null}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <StudentStatusBadge status={s.status} pausedUntil={s.pausedUntil} />
            {s.currentPlan ? (
              <span className="text-sm font-semibold text-muted-foreground">{describePlan(s.currentPlan)}</span>
            ) : null}
          </div>
          {s.status === StudentStatus.PAUSADO ? (
            <p className="mt-3 rounded-2xl bg-warning-soft px-4 py-2 text-sm text-warning-soft-foreground">
              Pausado{s.pausedUntil ? ` até ${formatDateShort(s.pausedUntil)}` : ''}. Sem aulas e cobranças nesse período.
            </p>
          ) : null}
        </header>

        <div className="mb-5 grid grid-cols-3 gap-2.5">
          <Button
            asChild={!!contactPhone}
            variant="soft"
            className="h-16 flex-col gap-1 bg-success-soft text-success-soft-foreground"
            disabled={!contactPhone}
          >
            {contactPhone ? (
              <a href={whatsappLink(contactPhone)} target="_blank" rel="noreferrer">
                <MessageCircle /> <span className="text-xs">WhatsApp</span>
              </a>
            ) : (
              <>
                <MessageCircle /> <span className="text-xs">WhatsApp</span>
              </>
            )}
          </Button>
          <Button
            asChild={!!contactPhone}
            variant="soft"
            className="h-16 flex-col gap-1 bg-[var(--stu-ceu)] text-[var(--stu-ceu-fg)]"
            disabled={!contactPhone}
          >
            {contactPhone ? (
              <a href={`tel:${dialNumber(contactPhone)}`}>
                <Phone /> <span className="text-xs">Ligar</span>
              </a>
            ) : (
              <>
                <Phone /> <span className="text-xs">Ligar</span>
              </>
            )}
          </Button>
          <Button asChild variant="soft" className="h-16 flex-col gap-1">
            <Link href={`/alunos/${s.id}/editar`}>
              <Pencil /> <span className="text-xs">Editar</span>
            </Link>
          </Button>
        </div>

        <div role="tablist" className="sticky top-[4.25rem] z-20 mb-5 grid grid-cols-4 gap-1 rounded-2xl bg-muted p-1.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              type="button"
              aria-selected={tab === t.value}
              onClick={() => {
                haptic(6);
                setTab(t.value);
              }}
              className={cn(
                'rounded-xl py-2 text-sm font-bold transition-all',
                tab === t.value ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div key={tab} role="tabpanel" className="animate-fade-up pb-8">
          {tab === 'resumo' ? (
            <SummaryTab s={s} today={today} />
          ) : tab === 'aulas' ? (
            <StudentLessonsTab student={s} today={today} />
          ) : tab === 'financeiro' ? (
            <StudentFinanceTab student={s} today={today} onChangePlan={() => setSheet('plan')} />
          ) : (
            <NotesTab s={s} />
          )}
        </div>
      </div>

      <ChangePlanSheet student={s} today={today} open={sheet === 'plan'} onOpenChange={(o) => setSheet(o ? 'plan' : null)} />
      <PauseSheet student={s} today={today} open={sheet === 'pause'} onOpenChange={(o) => setSheet(o ? 'pause' : null)} />
      <DeleteStudentSheet
        student={s}
        open={sheet === 'delete'}
        onOpenChange={(o) => setSheet(o ? 'delete' : null)}
        onArchive={() => setStatus(StudentStatus.INATIVO, `${name} foi arquivado`)}
      />
    </>
  );
}
