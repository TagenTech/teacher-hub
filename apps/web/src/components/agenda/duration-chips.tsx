'use client';

import { formatDuration, LESSON_DURATION_OPTIONS } from '@aulinha/contracts';
import { Chip } from '@/components/ui/chip';

export function DurationChips({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <p className="pl-1 text-sm font-semibold">Duração</p>
      <div className="flex flex-wrap gap-1.5">
        {LESSON_DURATION_OPTIONS.map((d) => (
          <Chip key={d} active={value === d} onClick={() => onChange(d)}>
            {formatDuration(d)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
