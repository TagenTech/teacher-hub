'use client';

import { DEFAULT_TIMEZONE, todayIn, type IsoDate } from '@turmei/contracts';
import { useAuth } from './auth';
import { useHydrated } from './use-hydrated';

/** "Hoje" no fuso do professor (null durante a hidratação). */
export function useToday(): IsoDate | null {
  const { teacher } = useAuth();
  return useHydrated() ? todayIn(teacher?.timezone ?? DEFAULT_TIMEZONE) : null;
}
