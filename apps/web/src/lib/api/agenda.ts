import type {
  AttendanceRequest,
  CreateLessonRequest,
  CreateScheduleBlockRequest,
  CreateSlotRequest,
  IsoDate,
  LessonDto,
  MakeupCreditDto,
  RescheduleRequest,
  ScheduleBlockDto,
  SlotDto,
  UpdateLessonRequest,
  UpdateSlotRequest,
} from '@turmei/contracts';
import { api } from './client';

const json = (body: unknown) => ({ body: JSON.stringify(body) });

export const agendaApi = {
  lessons: (from: IsoDate, to: IsoDate, studentId?: string) =>
    api<LessonDto[]>(`/lessons?from=${from}&to=${to}${studentId ? `&studentId=${studentId}` : ''}`),
  pending: () => api<LessonDto[]>('/lessons/pending'),
  lesson: (id: string) => api<LessonDto>(`/lessons/${id}`),
  createLesson: (body: CreateLessonRequest) => api<LessonDto>('/lessons', { method: 'POST', ...json(body) }),
  updateLesson: (id: string, body: UpdateLessonRequest) =>
    api<LessonDto>(`/lessons/${id}`, { method: 'PATCH', ...json(body) }),
  attendance: (id: string, body: AttendanceRequest) =>
    api<LessonDto>(`/lessons/${id}/attendance`, { method: 'POST', ...json(body) }),
  reschedule: (id: string, body: RescheduleRequest) =>
    api<LessonDto>(`/lessons/${id}/reschedule`, { method: 'POST', ...json(body) }),
  removeLesson: (id: string) => api<void>(`/lessons/${id}`, { method: 'DELETE' }),

  slots: (studentId: string) => api<SlotDto[]>(`/students/${studentId}/slots`),
  createSlot: (studentId: string, body: CreateSlotRequest) =>
    api<SlotDto>(`/students/${studentId}/slots`, { method: 'POST', ...json(body) }),
  updateSlot: (id: string, body: UpdateSlotRequest) => api<SlotDto>(`/slots/${id}`, { method: 'PATCH', ...json(body) }),
  endSlot: (id: string, from: IsoDate) => api<void>(`/slots/${id}?from=${from}`, { method: 'DELETE' }),

  makeups: (params: { studentId?: string; status?: string } = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return api<MakeupCreditDto[]>(`/makeup-credits${q.size ? `?${q}` : ''}`);
  },
  cancelMakeup: (id: string) => api<void>(`/makeup-credits/${id}`, { method: 'DELETE' }),

  blocks: () => api<ScheduleBlockDto[]>('/schedule-blocks'),
  createBlock: (body: CreateScheduleBlockRequest) =>
    api<{ block: ScheduleBlockDto; canceled: number }>('/schedule-blocks', { method: 'POST', ...json(body) }),
  removeBlock: (id: string) => api<void>(`/schedule-blocks/${id}`, { method: 'DELETE' }),
};
