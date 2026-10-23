'use client';

import {
  attendanceDefaults,
  displayName,
  formatDuration,
  LessonStatus,
  zonedToUtc,
  type LessonDto,
} from '@aulinha/contracts';
import { CalendarClock, ExternalLink, MapPin, NotebookPen, Trash2, Undo2, Video } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { StudentAvatar } from '@/components/students/student-avatar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { SwitchRow } from '@/components/ui/switch-row';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { capitalize, dateOf, relativeDay, timeOf } from '@/lib/format';
import { useAttendance, useLesson, useRemoveLesson, useReschedule, useUpdateLesson } from '@/lib/queries/agenda';
import { useToday } from '@/lib/use-today';
import { useTz } from '@/lib/use-tz';
import { addDays } from '@aulinha/contracts';
import { cn, haptic } from '@/lib/utils';
import { LessonStatusBadge } from './lesson-status';

type Step = 'details' | 'absence' | 'reschedule' | 'notes';
type AbsenceKind = typeof LessonStatus.FALTA_ALUNO | typeof LessonStatus.FALTA_PROFESSOR | typeof LessonStatus.CANCELADA;

const REASONS = ['Doente', 'Viagem', 'Compromisso', 'Esqueceu', 'Clima', 'Imprevisto'];

const errMsg = (err: unknown, fallback: string) => (err instanceof ApiError ? (err.details?.[0] ?? err.message) : fallback);

function AbsenceForm({ lesson, onDone }: { lesson: LessonDto; onDone: () => void }) {
  const attendance = useAttendance();
  const [kind, setKind] = React.useState<AbsenceKind>(LessonStatus.FALTA_ALUNO);
  const [justified, setJustified] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const defaults = attendanceDefaults(kind, justified);
  const [chargeable, setChargeable] = React.useState<boolean | null>(null);
  const [makeup, setMakeup] = React.useState<boolean | null>(null);
  const isMakeupLesson = !!lesson.makeupCreditId;
  const charge = isMakeupLesson ? false : (chargeable ?? defaults.chargeable);
  const credit = makeup ?? defaults.makeup;

  const save = () => {
    haptic(15);
    attendance.mutate(
      {
        id: lesson.id,
        body: { status: kind, justified, reason: reason.trim() || null, chargeable: charge, createMakeup: credit },
      },
      {
        onSuccess: () =>
          toast.success(
            kind === LessonStatus.CANCELADA ? 'Aula cancelada' : 'Falta registrada' + (credit ? ' · reposição criada 🔁' : ''),
          ),
        onError: (err) => toast.error(errMsg(err, 'Não foi possível salvar')),
      },
    );
    onDone();
  };

  const kinds: { value: AbsenceKind; label: string }[] = [
    { value: LessonStatus.FALTA_ALUNO, label: 'Aluno faltou' },
    { value: LessonStatus.FALTA_PROFESSOR, label: 'Eu faltei' },
    { value: LessonStatus.CANCELADA, label: 'Cancelada' },
  ];

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Quem faltou" className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1.5">
        {kinds.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={kind === k.value}
            onClick={() => {
              setKind(k.value);
              setChargeable(null);
              setMakeup(null);
            }}
            className={cn(
              'rounded-xl py-2.5 text-sm font-bold transition-all',
              kind === k.value ? 'bg-card shadow-soft' : 'text-muted-foreground',
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      {kind === LessonStatus.FALTA_ALUNO ? (
        <SwitchRow
          id="justified"
          checked={justified}
          onCheckedChange={(v) => {
            setJustified(v);
            setChargeable(null);
            setMakeup(null);
          }}
          title="Falta justificada"
          description="Avisou com antecedência ou teve um bom motivo."
        />
      ) : null}

      <div className="space-y-2">
        <label htmlFor="absence-reason" className="block pl-1 text-sm font-semibold">
          Motivo
        </label>
        <div className="flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <Chip key={r} active={reason === r} onClick={() => setReason(reason === r ? '' : r)}>
              {r}
            </Chip>
          ))}
        </div>
        <Input id="absence-reason" placeholder="Ou escreva…" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      <div className="space-y-2 rounded-2xl bg-muted/60 p-3">
        <p className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">O que acontece</p>
        {isMakeupLesson ? (
          <p className="px-1 text-sm text-muted-foreground">É uma reposição: não é cobrada.</p>
        ) : (
          <SwitchRow
            id="charge"
            checked={charge}
            onCheckedChange={setChargeable}
            title={charge ? 'Aula será cobrada' : 'Aula não será cobrada'}
          />
        )}
        <SwitchRow
          id="makeup"
          checked={credit}
          onCheckedChange={setMakeup}
          title={credit ? 'Gera uma reposição 🔁' : 'Sem reposição'}
          description={credit ? 'Fica na lista de reposições para agendar.' : undefined}
        />
      </div>

      <Button block size="lg" onClick={save}>
        Registrar
      </Button>
    </div>
  );
}

function RescheduleForm({ lesson, onDone }: { lesson: LessonDto; onDone: () => void }) {
  const tz = useTz();
  const reschedule = useReschedule();
  const [date, setDate] = React.useState(dateOf(lesson.startsAt, tz));
  const [time, setTime] = React.useState(timeOf(lesson.startsAt, tz));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Novo dia" htmlFor="rs-date">
          <Input id="rs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Horário" htmlFor="rs-time">
          <Input id="rs-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <p className="text-sm text-muted-foreground">A data original fica no histórico como “remarcada”.</p>
      <Button
        block
        size="lg"
        loading={reschedule.isPending}
        disabled={!date || !time}
        onClick={() =>
          reschedule.mutate(
            { id: lesson.id, body: { startsAt: zonedToUtc(date, time, tz).toISOString() } },
            {
              onSuccess: () => {
                haptic(15);
                toast.success('Aula remarcada 📅');
                onDone();
              },
              onError: (err) => toast.error(errMsg(err, 'Não foi possível remarcar')),
            },
          )
        }
      >
        Remarcar
      </Button>
    </div>
  );
}

function NotesForm({ lesson, onDone }: { lesson: LessonDto; onDone: () => void }) {
  const update = useUpdateLesson();
  const [content, setContent] = React.useState(lesson.content ?? '');
  const [homework, setHomework] = React.useState(lesson.homework ?? '');
  return (
    <div className="space-y-4">
      <Field label="O que foi ensinado" htmlFor="ls-content">
        <Textarea id="ls-content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Escalas, capítulo 3, revisão…" />
      </Field>
      <Field label="Tarefa para casa" htmlFor="ls-homework">
        <Textarea id="ls-homework" value={homework} onChange={(e) => setHomework(e.target.value)} className="min-h-20" />
      </Field>
      <Button
        block
        size="lg"
        loading={update.isPending}
        onClick={() =>
          update.mutate(
            { id: lesson.id, body: { content: content.trim() || null, homework: homework.trim() || null } },
            {
              onSuccess: () => {
                toast.success('Anotações salvas 📝');
                onDone();
              },
              onError: (err) => toast.error(errMsg(err, 'Não foi possível salvar')),
            },
          )
        }
      >
        Salvar anotações
      </Button>
    </div>
  );
}

export function LessonSheet({
  lessonId,
  initialStep,
  onClose,
}: {
  lessonId: string | null;
  initialStep: 'details' | 'absence';
  onClose: () => void;
}) {
  const tz = useTz();
  const today = useToday();
  const { data: lesson } = useLesson(lessonId);
  const attendance = useAttendance();
  const remove = useRemoveLesson();
  const [step, setStep] = React.useState<Step>(initialStep);
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  // Cada abertura começa no passo pedido.
  if (lessonId && openedFor !== lessonId + initialStep) {
    setOpenedFor(lessonId + initialStep);
    setStep(initialStep);
  }

  const open = !!lessonId;
  const date = lesson ? dateOf(lesson.startsAt, tz) : null;
  const dayLabel =
    lesson && today && date ? capitalize(relativeDay(date, today, addDays(today, 1), addDays(today, -1))) : '';

  const title =
    step === 'absence' ? 'Registrar falta' : step === 'reschedule' ? 'Remarcar aula' : step === 'notes' ? 'Anotações da aula' : 'Aula';

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={title}>
      {!lesson ? (
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <StudentAvatar name={lesson.student.name} color={lesson.student.color} emoji={lesson.student.emoji} />
            <div className="min-w-0 flex-1">
              <Link
                href={`/alunos/${lesson.student.id}`}
                onClick={onClose}
                className="block truncate font-display text-lg font-extrabold underline-offset-4 hover:underline"
              >
                {displayName(lesson.student)}
              </Link>
              <p className="text-sm text-muted-foreground">
                {dayLabel} · {timeOf(lesson.startsAt, tz)}–{timeOf(lesson.endsAt, tz)} ({formatDuration(lesson.durationMin)})
              </p>
            </div>
            {lesson.status !== LessonStatus.AGENDADA ? (
              <LessonStatusBadge status={lesson.status} justified={lesson.justified} />
            ) : null}
          </div>

          {step === 'details' ? (
            <>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-semibold">
                  {lesson.mode === 'ONLINE' ? <Video className="size-4" /> : <MapPin className="size-4" />}
                  {lesson.mode === 'ONLINE' ? 'Online' : (lesson.location ?? 'Presencial')}
                </span>
                {lesson.meetingUrl ? (
                  <a
                    href={lesson.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary-soft-foreground"
                  >
                    <ExternalLink className="size-4" /> Abrir chamada
                  </a>
                ) : null}
                {lesson.makeupCreditId ? (
                  <span className="rounded-full bg-sky-soft px-3 py-1.5 text-sm font-semibold">🔁 Reposição</span>
                ) : null}
              </div>

              {lesson.absenceReason ? (
                <p className="rounded-2xl bg-muted px-4 py-3 text-sm">
                  <strong>Motivo:</strong> {lesson.absenceReason}
                </p>
              ) : null}

              {lesson.status === LessonStatus.AGENDADA ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    size="lg"
                    className="col-span-2 bg-success text-white shadow-none hover:bg-success hover:brightness-95"
                    onClick={() => {
                      haptic([12, 40, 18]);
                      attendance.mutate(
                        { id: lesson.id, body: { status: LessonStatus.REALIZADA } },
                        { onError: (err) => toast.error(errMsg(err, 'Não foi possível marcar')) },
                      );
                      toast.success('Aula realizada ✓');
                      onClose();
                    }}
                  >
                    ✓ Aula realizada
                  </Button>
                  <Button variant="danger" onClick={() => setStep('absence')}>
                    Faltou / cancelar
                  </Button>
                  <Button variant="soft" onClick={() => setStep('reschedule')}>
                    <CalendarClock /> Remarcar
                  </Button>
                </div>
              ) : lesson.status !== LessonStatus.REMARCADA ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {lesson.chargeable
                      ? '💰 Entra na cobrança' + (lesson.priceCents ? '' : ' (mensalidade)')
                      : 'Não é cobrada'}
                  </p>
                  <Button
                    variant="outline"
                    block
                    onClick={() => {
                      attendance.mutate(
                        { id: lesson.id, body: { status: LessonStatus.AGENDADA } },
                        {
                          onSuccess: () => toast('Marcação desfeita'),
                          onError: (err) => toast.error(errMsg(err, 'Não foi possível desfazer')),
                        },
                      );
                    }}
                  >
                    <Undo2 /> Desfazer marcação
                  </Button>
                </div>
              ) : (
                <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                  Esta aula foi remarcada para outra data.
                </p>
              )}

              <button
                type="button"
                onClick={() => setStep('notes')}
                className="flex w-full items-center gap-3 rounded-2xl border border-border p-3.5 text-left hover:bg-muted"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                  <NotebookPen className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Anotações da aula</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {lesson.content ?? lesson.homework ?? 'O que foi ensinado e a tarefa'}
                  </span>
                </span>
              </button>

              {!lesson.slotId && lesson.status === LessonStatus.AGENDADA ? (
                <Button
                  variant="ghost"
                  block
                  className="text-danger"
                  loading={remove.isPending}
                  onClick={() =>
                    remove.mutate(lesson.id, {
                      onSuccess: () => {
                        toast('Aula apagada');
                        onClose();
                      },
                      onError: (err) => toast.error(errMsg(err, 'Não foi possível apagar')),
                    })
                  }
                >
                  <Trash2 /> Apagar aula avulsa
                </Button>
              ) : null}
            </>
          ) : step === 'absence' ? (
            <AbsenceForm lesson={lesson} onDone={onClose} />
          ) : step === 'reschedule' ? (
            <RescheduleForm lesson={lesson} onDone={onClose} />
          ) : (
            <NotesForm lesson={lesson} onDone={() => setStep('details')} />
          )}

          {step !== 'details' ? (
            <Button variant="ghost" block onClick={() => setStep('details')}>
              Voltar
            </Button>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
