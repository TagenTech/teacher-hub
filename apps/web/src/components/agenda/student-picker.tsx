'use client';

import { displayName, searchable, StudentStatus } from '@aulinha/contracts';
import { Search } from 'lucide-react';
import * as React from 'react';
import { StudentAvatar } from '@/components/students/student-avatar';
import { Input } from '@/components/ui/input';
import { useStudents } from '@/lib/queries/students';
import { cn } from '@/lib/utils';

export function StudentPicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const { data } = useStudents();
  const [q, setQ] = React.useState('');
  const term = searchable(q);
  const list = (data ?? [])
    .filter((s) => s.status !== StudentStatus.INATIVO)
    .filter((s) => !term || searchable(`${s.name} ${s.nickname ?? ''}`).includes(term));

  return (
    <div className="space-y-2">
      <Input
        aria-label="Buscar aluno"
        placeholder="Buscar aluno…"
        icon={<Search />}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div role="radiogroup" aria-label="Aluno" className="max-h-56 space-y-1 overflow-y-auto rounded-2xl">
        {list.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={value === s.id}
            onClick={() => onChange(s.id)}
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl border-2 p-2 text-left transition-all',
              value === s.id ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-muted',
            )}
          >
            <StudentAvatar name={s.name} color={s.color} emoji={s.emoji} size="sm" />
            <span className="min-w-0 flex-1 truncate font-semibold">{displayName(s)}</span>
            {s.status === StudentStatus.PAUSADO ? <span className="text-xs text-warning">pausado</span> : null}
          </button>
        ))}
        {!list.length ? <p className="p-3 text-sm text-muted-foreground">Nenhum aluno encontrado.</p> : null}
      </div>
    </div>
  );
}
