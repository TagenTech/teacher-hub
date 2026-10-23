'use client';

import { DEFAULT_TIMEZONE } from '@aulinha/contracts';
import { useAuth } from './auth';

export function useTz(): string {
  return useAuth().teacher?.timezone ?? DEFAULT_TIMEZONE;
}
