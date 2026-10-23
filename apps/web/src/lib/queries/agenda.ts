'use client';

import type {
  AttendanceRequest,
  CreateLessonRequest,
  CreateScheduleBlockRequest,
  CreateSlotRequest,
  IsoDate,
  LessonDto,
  RescheduleRequest,
  UpdateLessonRequest,
  UpdateSlotRequest,
} from '@aulinha/contracts';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { agendaApi } from '@/lib/api/agenda';

export const agendaKeys = {
  lessons: ['lessons'] as const,
  range: (from: IsoDate, to: IsoDate, studentId?: string) => ['lessons', 'range', from, to, studentId ?? ''] as const,
  pending: ['lessons', 'pending'] as const,
  lesson: (id: string) => ['lessons', 'one', id] as const,
  slots: (studentId: string) => ['slots', studentId] as const,
  makeups: (params: object) => ['makeups', params] as const,
  blocks: ['blocks'] as const,
  dashboard: ['dashboard'] as const,
};

export function useLessons(from: IsoDate, to: IsoDate, studentId?: string, enabled = true) {
  return useQuery({
    queryKey: agendaKeys.range(from, to, studentId),
    queryFn: () => agendaApi.lessons(from, to, studentId),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export const usePendingLessons = () => useQuery({ queryKey: agendaKeys.pending, queryFn: agendaApi.pending });
export function useLesson(id: string | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: agendaKeys.lesson(id ?? ''),
    queryFn: () => agendaApi.lesson(id!),
    enabled: !!id,
    initialData: () => {
      if (!id) return undefined;
      for (const [, data] of qc.getQueriesData<LessonDto[]>({ queryKey: ['lessons'] })) {
        const hit = Array.isArray(data) ? data.find((l) => l.id === id) : undefined;
        if (hit) return hit;
      }
      return undefined;
    },
    initialDataUpdatedAt: 0,
    placeholderData: (prev) => prev,
  });
}
export const useSlots = (studentId: string) =>
  useQuery({ queryKey: agendaKeys.slots(studentId), queryFn: () => agendaApi.slots(studentId) });
export const useMakeups = (params: { studentId?: string; status?: string } = {}) =>
  useQuery({ queryKey: agendaKeys.makeups(params), queryFn: () => agendaApi.makeups(params) });
export const useBlocks = () => useQuery({ queryKey: agendaKeys.blocks, queryFn: agendaApi.blocks });

/** Tudo que depende de aulas (listas, pendentes, painel, reposições, cobranças) é recarregado. */
export function invalidateAgenda(qc: QueryClient) {
  for (const key of [['lessons'], ['makeups'], ['slots'], ['dashboard'], ['charges'], ['finance']]) {
    qc.invalidateQueries({ queryKey: key });
  }
}

/** Troca a aula em todas as listas em cache (atualização otimista). */
function patchCachedLesson(qc: QueryClient, id: string, patch: Partial<LessonDto> | ((l: LessonDto) => LessonDto)) {
  const apply = (l: LessonDto) => (l.id !== id ? l : typeof patch === 'function' ? patch(l) : { ...l, ...patch });
  qc.setQueriesData<LessonDto[]>({ queryKey: ['lessons', 'range'] }, (old) => old?.map(apply));
  qc.setQueriesData<LessonDto[]>({ queryKey: agendaKeys.pending }, (old) => old?.map(apply));
  qc.setQueryData<LessonDto>(agendaKeys.lesson(id), (old) => (old ? apply(old) : old));
}

export function useAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AttendanceRequest }) => agendaApi.attendance(id, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: ['lessons'] });
      patchCachedLesson(qc, id, { status: body.status, justified: !!body.justified });
    },
    onSettled: () => invalidateAgenda(qc),
  });
}

function useAgendaMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateAgenda(qc) });
}

export const useCreateLesson = () => useAgendaMutation((b: CreateLessonRequest) => agendaApi.createLesson(b));
export const useUpdateLesson = () =>
  useAgendaMutation(({ id, body }: { id: string; body: UpdateLessonRequest }) => agendaApi.updateLesson(id, body));
export const useReschedule = () =>
  useAgendaMutation(({ id, body }: { id: string; body: RescheduleRequest }) => agendaApi.reschedule(id, body));
export const useRemoveLesson = () => useAgendaMutation((id: string) => agendaApi.removeLesson(id));
export const useCreateSlot = (studentId: string) =>
  useAgendaMutation((b: CreateSlotRequest) => agendaApi.createSlot(studentId, b));
export const useUpdateSlot = () =>
  useAgendaMutation(({ id, body }: { id: string; body: UpdateSlotRequest }) => agendaApi.updateSlot(id, body));
export const useEndSlot = () => useAgendaMutation(({ id, from }: { id: string; from: IsoDate }) => agendaApi.endSlot(id, from));
export const useCancelMakeup = () => useAgendaMutation((id: string) => agendaApi.cancelMakeup(id));
export const useCreateBlock = () => useAgendaMutation((b: CreateScheduleBlockRequest) => agendaApi.createBlock(b));
export const useRemoveBlock = () => useAgendaMutation((id: string) => agendaApi.removeBlock(id));
