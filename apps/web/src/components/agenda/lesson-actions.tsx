'use client';

import { displayName, LessonStatus, type IsoDate, type LessonDto, type MakeupCreditDto } from '@aulinha/contracts';
import * as React from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { useAttendance } from '@/lib/queries/agenda';
import { haptic } from '@/lib/utils';
import { LessonSheet } from './lesson-sheet';
import { NewLessonSheet } from './new-lesson-sheet';

export interface NewLessonPrefill {
  studentId?: string;
  date?: IsoDate;
  time?: string;
  makeup?: MakeupCreditDto;
  /** Abre já com "repetir toda semana" ligado (criar horário fixo). */
  weekly?: boolean;
}

interface LessonActions {
  openLesson: (id: string, step?: 'details' | 'absence') => void;
  openNewLesson: (prefill?: NewLessonPrefill) => void;
  markDone: (lesson: LessonDto) => void;
}

const Ctx = React.createContext<LessonActions | null>(null);

export function useLessonActions() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useLessonActions precisa de <LessonActionsProvider>');
  return ctx;
}

/** Folhas de aula compartilhadas por todas as telas (agenda, hoje, ficha do aluno, botão +). */
export function LessonActionsProvider({ children }: { children: React.ReactNode }) {
  const attendance = useAttendance();
  const [lesson, setLesson] = React.useState<{ id: string; step: 'details' | 'absence' } | null>(null);
  const [newLesson, setNewLesson] = React.useState<NewLessonPrefill | null>(null);

  const markDone = React.useCallback(
    (l: LessonDto) => {
      haptic([12, 40, 18]);
      attendance.mutate(
        { id: l.id, body: { status: LessonStatus.REALIZADA } },
        {
          onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Não foi possível marcar'),
        },
      );
      toast.success(`Aula com ${displayName(l.student)} realizada ✓`, {
        action: {
          label: 'Desfazer',
          onClick: () => attendance.mutate({ id: l.id, body: { status: LessonStatus.AGENDADA } }),
        },
      });
    },
    [attendance],
  );

  const value = React.useMemo<LessonActions>(
    () => ({
      openLesson: (id, step = 'details') => setLesson({ id, step }),
      openNewLesson: (prefill = {}) => setNewLesson(prefill),
      markDone,
    }),
    [markDone],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <LessonSheet
        lessonId={lesson?.id ?? null}
        initialStep={lesson?.step ?? 'details'}
        onClose={() => setLesson(null)}
      />
      <NewLessonSheet prefill={newLesson} onClose={() => setNewLesson(null)} />
    </Ctx.Provider>
  );
}
