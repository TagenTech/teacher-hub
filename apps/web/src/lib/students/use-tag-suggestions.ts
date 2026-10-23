'use client';

import * as React from 'react';
import { useStudents } from '@/lib/queries/students';

/** Etiquetas já usadas, das mais frequentes para as menos. */
export function useTagSuggestions(): string[] {
  const { data } = useStudents();
  return React.useMemo(() => {
    const count = new Map<string, number>();
    for (const s of data ?? []) for (const t of s.tags) count.set(t, (count.get(t) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  }, [data]);
}
