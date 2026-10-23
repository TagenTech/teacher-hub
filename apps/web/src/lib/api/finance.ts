import type {
  ChargeDto,
  CreateChargeRequest,
  MonthSummaryDto,
  ReceiptDto,
  RegisterPaymentRequest,
  TeacherDto,
  UpdateChargeRequest,
  UpdateSettingsRequest,
  WhatsappMessageDto,
} from '@aulinha/contracts';
import { api } from './client';

const json = (body: unknown) => ({ body: JSON.stringify(body) });
export type ChargeFilter = 'abertas' | 'atrasadas' | 'pagas' | 'todas';

export const financeApi = {
  charges: (p: { month?: string; studentId?: string; status?: ChargeFilter }) => {
    const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]);
    return api<ChargeDto[]>(`/charges?${q}`);
  },
  charge: (id: string) => api<ChargeDto>(`/charges/${id}`),
  summary: (month: string) => api<MonthSummaryDto>(`/finance/summary?month=${month}`),
  highlights: () => api<{ dueSoon: ChargeDto[]; overdue: ChargeDto[] }>('/finance/highlights'),
  preview: (studentId: string) =>
    api<{ month: string; lessonsCount: number; amountCents: number }>(`/students/${studentId}/billing-preview`),
  closeMonth: (studentId: string, month: string) =>
    api<{ created: number }>('/charges/close-month', { method: 'POST', ...json({ studentId, month }) }),
  create: (body: CreateChargeRequest) => api<ChargeDto>('/charges', { method: 'POST', ...json(body) }),
  update: (id: string, body: UpdateChargeRequest) => api<ChargeDto>(`/charges/${id}`, { method: 'PATCH', ...json(body) }),
  cancel: (id: string) => api<ChargeDto>(`/charges/${id}/cancel`, { method: 'POST' }),
  reopen: (id: string) => api<ChargeDto>(`/charges/${id}/reopen`, { method: 'POST' }),
  remove: (id: string) => api<void>(`/charges/${id}`, { method: 'DELETE' }),
  whatsapp: (id: string) => api<WhatsappMessageDto>(`/charges/${id}/whatsapp`),
  pay: (id: string, body: RegisterPaymentRequest) =>
    api<ChargeDto>(`/charges/${id}/payments`, { method: 'POST', ...json(body) }),
  removePayment: (id: string) => api<ChargeDto>(`/payments/${id}`, { method: 'DELETE' }),
  receipt: (paymentId: string) => api<ReceiptDto>(`/payments/${paymentId}/receipt`),
  updateSettings: (body: UpdateSettingsRequest) =>
    api<TeacherDto>('/me/settings', { method: 'PATCH', ...json(body) }),
};
