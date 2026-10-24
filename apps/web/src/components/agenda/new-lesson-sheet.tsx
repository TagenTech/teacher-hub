'use client';

import {
  displayName,
  LessonMode,
  WEEKDAYS,
  weekdayOf,
  zonedParts,
  zonedToUtc,
} from '@turmei/contracts';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { SwitchRow } from '@/components/ui/switch-row';
import { agendaApi } from '@/lib/api/agenda';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import { invalidateAgenda } from '@/lib/queries/agenda';
import { useStudents } from '@/lib/queries/students';
import { useTz } from '@/lib/use-tz';
import { haptic } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { DurationChips } from './duration-chips';
import type { NewLessonPrefill } from './lesson-actions';
import { LessonPlaceFields, type PlaceValue } from './lesson-place-fields';
import { StudentPicker } from './student-picker';

function nextRoundHour(tz: string) {
  const p = zonedParts(new Date(Date.now() + 60 * 60_000), tz);
  return { date: p.date, time: `${p.time.slice(0, 2)}:00` };
}

export function NewLessonSheet({ prefill, onClose }: { prefill: NewLessonPrefill | null; onClose: () => void }) {
  const tz = useTz();
  const { teacher } = useAuth();
  const { data: students } = useStudents();
  const qc = useQueryClient();
  const [studentId, setStudentId] = React.useState<string | null>(null);
  const [date, setDate] = React.useState('');
  const [time, setTime] = React.useState('');
  const [duration, setDuration] = React.useState(60);
  const [weekly, setWeekly] = React.useState(false);
  const [place, setPlace] = React.useState<PlaceValue>({ mode: LessonMode.PRESENCIAL, location: '', meetingUrl: '' });
  const [saving, setSaving] = React.useState(false);
  const [openedWith, setOpenedWith] = React.useState<NewLessonPrefill | null>(null);

  // Reinicia o formulário a cada abertura.
  if (prefill && prefill !== openedWith) {
    const def = nextRoundHour(tz);
    setOpenedWith(prefill);
    setStudentId(prefill.makeup?.student.id ?? prefill.studentId ?? null);
    setDate(prefill.date ?? def.date);
    setTime(prefill.time ?? def.time);
    setDuration(teacher?.defaultLessonMinutes ?? 60);
    setWeekly(!!prefill.weekly);
    setPlace({ mode: LessonMode.PRESENCIAL, location: '', meetingUrl: '' });
  }

  const makeup = prefill?.makeup;
  const student = students?.find((s) => s.id === studentId);
  const lockedStudent = !!(prefill?.studentId || makeup);

  const save = async () => {
    if (!studentId || !date || !time) {
      toast.error('Escolha aluno, dia e horário');
      return;
    }
    setSaving(true);
    try {
      const common = {
        mode: place.mode,
        location: place.mode === LessonMode.PRESENCIAL ? place.location.trim() || null : null,
        meetingUrl: place.mode === LessonMode.ONLINE ? place.meetingUrl.trim() || null : null,
      };
      if (weekly && !makeup) {
        await agendaApi.createSlot(studentId, {
          ...common,
          weekday: weekdayOf(date),
          startTime: time,
          durationMin: duration,
          validFrom: date,
        });
        toast.success(`Toda ${WEEKDAYS[weekdayOf(date)]} às ${time} na agenda 🗓️`);
      } else {
        await agendaApi.createLesson({
          ...common,
          studentId,
          startsAt: zonedToUtc(date, time, tz).toISOString(),
          durationMin: duration,
          makeupCreditId: makeup?.id ?? null,
        });
        toast.success(makeup ? 'Reposição agendada 🔁' : 'Aula agendada 🗓️');
      }
      haptic([12, 40, 18]);
      invalidateAgenda(qc);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? (err.details?.[0] ?? err.message) : 'Não foi possível agendar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={!!prefill}
      onOpenChange={(o) => !o && onClose()}
      title={makeup ? 'Agendar reposição' : weekly ? 'Novo horário fixo' : 'Nova aula'}
      description={
        makeup ? `Reposição de ${displayName(makeup.student)}${makeup.reason ? ` · ${makeup.reason}` : ''}` : undefined
      }
    >
      <div className="space-y-5">
        {lockedStudent && student ? null : (
          <div className="space-y-2">
            <p className="pl-1 text-sm font-semibold">Aluno</p>
            <StudentPicker value={studentId} onChange={setStudentId} />
          </div>
        )}
        {lockedStudent && student ? (
          <p className="rounded-2xl bg-muted px-4 py-3 font-semibold">{displayName(student)}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label={weekly ? 'Começa em' : 'Dia'} htmlFor="nl-date">
            <Input id="nl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Horário" htmlFor="nl-time">
            <Input id="nl-time" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>

        <DurationChips value={duration} onChange={setDuration} />
        <LessonPlaceFields value={place} onChange={setPlace} />

        {!makeup ? (
          <SwitchRow
            id="weekly"
            checked={weekly}
            onCheckedChange={setWeekly}
            title="Repetir toda semana"
            description={
              weekly && date ? `Toda ${WEEKDAYS[weekdayOf(date)]} às ${time || '--:--'}, gerando as aulas sozinho.` : 'Vira um horário fixo do aluno.'
            }
          />
        ) : null}

        <Button block size="lg" loading={saving} onClick={save}>
          {weekly && !makeup ? 'Criar horário fixo' : makeup ? 'Agendar reposição' : 'Agendar aula'}
        </Button>
      </div>
    </Sheet>
  );
}
