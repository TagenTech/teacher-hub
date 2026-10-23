import type {
  ChangeStudentStatusRequest,
  CreateBillingPlanRequest,
  CreateStudentRequest,
  StudentDetailDto,
  StudentListItemDto,
  UpdateStudentRequest,
} from '@aulinha/contracts';
import { api } from './client';

export const studentsApi = {
  list: () => api<StudentListItemDto[]>('/students'),
  get: (id: string) => api<StudentDetailDto>(`/students/${id}`),
  create: (body: CreateStudentRequest) =>
    api<StudentDetailDto>('/students', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: UpdateStudentRequest) =>
    api<StudentDetailDto>(`/students/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  changeStatus: (id: string, body: ChangeStudentStatusRequest) =>
    api<StudentDetailDto>(`/students/${id}/status`, { method: 'POST', body: JSON.stringify(body) }),
  remove: (id: string) => api<void>(`/students/${id}`, { method: 'DELETE' }),
  addPlan: (id: string, body: CreateBillingPlanRequest) =>
    api<StudentDetailDto>(`/students/${id}/plans`, { method: 'POST', body: JSON.stringify(body) }),
  removePlan: (id: string, planId: string) =>
    api<StudentDetailDto>(`/students/${id}/plans/${planId}`, { method: 'DELETE' }),
};
