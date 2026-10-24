'use client';

import { LessonMode } from '@turmei/contracts';
import { Link2, MapPin } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface PlaceValue {
  mode: LessonMode;
  location: string;
  meetingUrl: string;
}

export function LessonPlaceFields({ value, onChange }: { value: PlaceValue; onChange: (v: PlaceValue) => void }) {
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Formato" className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1.5">
        {[
          { v: LessonMode.PRESENCIAL, l: '📍 Presencial' },
          { v: LessonMode.ONLINE, l: '💻 Online' },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={value.mode === o.v}
            onClick={() => onChange({ ...value, mode: o.v })}
            className={cn(
              'rounded-xl py-2.5 text-sm font-bold transition-all',
              value.mode === o.v ? 'bg-card shadow-soft' : 'text-muted-foreground',
            )}
          >
            {o.l}
          </button>
        ))}
      </div>
      {value.mode === LessonMode.PRESENCIAL ? (
        <Field label="Onde" htmlFor="lp-location">
          <Input
            id="lp-location"
            icon={<MapPin />}
            placeholder="Estúdio, casa do aluno… (opcional)"
            value={value.location}
            onChange={(e) => onChange({ ...value, location: e.target.value })}
          />
        </Field>
      ) : (
        <Field label="Link da chamada" htmlFor="lp-url" hint="Meet, Zoom… (opcional)">
          <Input
            id="lp-url"
            type="url"
            inputMode="url"
            icon={<Link2 />}
            placeholder="https://meet.google.com/…"
            value={value.meetingUrl}
            onChange={(e) => onChange({ ...value, meetingUrl: e.target.value })}
          />
        </Field>
      )}
    </div>
  );
}
