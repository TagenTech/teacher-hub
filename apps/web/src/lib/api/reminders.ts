import type { CalendarFeedDto, PushStatusDto, PushSubscriptionRequest } from '@turmei/contracts';
import { api } from './client';

export const remindersApi = {
  status: () => api<PushStatusDto>('/push/status'),
  subscribe: (body: PushSubscriptionRequest) => api<void>('/push/subscribe', { method: 'POST', body: JSON.stringify(body) }),
  unsubscribe: (endpoint: string) => api<void>('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
  test: () => api<{ delivered: number }>('/push/test', { method: 'POST' }),
  feed: () => api<CalendarFeedDto>('/calendar/feed'),
  rotateFeed: () => api<CalendarFeedDto>('/calendar/rotate', { method: 'POST' }),
};
