'use client';

import { DEFAULT_TIMEZONE } from '@turmei/contracts';
import { useAuth } from './auth';

export function useTz(): string {
  return useAuth().teacher?.timezone ?? DEFAULT_TIMEZONE;
}
