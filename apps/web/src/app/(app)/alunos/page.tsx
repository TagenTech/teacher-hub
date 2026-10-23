'use client';

import { searchable, StudentStatus, type StudentListItemDto } from '@aulinha/contracts';
import { Search, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { StudentRow } from '@/components/students/student-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudents } from '@/lib/queries/students';
import { useTagSuggestions } from '@/lib/students/use-tag-suggestions';

type StatusFilter = StudentStatus | 'TODOS';

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: StudentStatus.ATIVO, label: 'Ativos' },
  { value: StudentStatus.PAUSADO, label: 'Pausados' },
  { value: StudentStatus.INATIVO, label: 'Inativos' },
  { value: 'TODOS', label: 'Todos' },
];

function matches(s: StudentListItemDto, term: string, digits: string) {
  const hay = searchable([s.name, s.nickname, s.guardianName, ...s.tags].filter(Boolean).join(' '));
  if (hay.includes(term)) return true;
  return digits.length >= 3 && [s.phone, s.guardianPhone].some((p) => p?.includes(digits));
}

export default function AlunosPage() {
  const { data, isPending, isError, refetch } = useStudents();
  const tags = useTagSuggestions();
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState<StatusFilter>(StudentStatus.ATIVO);
  const [tag, setTag] = React.useState<string | null>(null);

  const students = React.useMemo(() => data ?? [], [data]);
  const counts = React.useMemo(() => {
    const c: Record<StatusFilter, number> = { ATIVO: 0, PAUSADO: 0, INATIVO: 0, TODOS: students.length };
    for (const s of students) c[s.status]++;
    return c;
  }, [students]);

  const term = searchable(q);
  const digits = q.replace(/\D/g, '');
  const filtered = students.filter(
    (s) =>
      // Buscando, procura em todos os status — ninguém some por estar pausado.
      (term || status === 'TODOS' || s.status === status) &&
      (!tag || s.tags.includes(tag)) &&
      (!term || matches(s, term, digits)),
  );

  return (
    <>
      <PageHeader
        title="Alunos"
        subtitle={
          data ? `${counts.ATIVO} ${counts.ATIVO === 1 ? 'ativo' : 'ativos'}` : 'Quem aprende com você'
        }
        action={
          students.length ? (
            <Button asChild size="sm" variant="soft">
              <Link href="/alunos/novo">
                <UserPlus className="!size-4" /> Novo
              </Link>
            </Button>
          ) : null
        }
      />

      {isPending ? (
        <div className="space-y-3 px-5">
          <Skeleton className="h-13" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3.5 p-3">
              <Skeleton className="size-12" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          emoji="🫧"
          tone="sky"
          title="Não deu para carregar"
          description="Confira a internet e tente de novo."
          action={<Button onClick={() => refetch()}>Tentar de novo</Button>}
        />
      ) : !students.length ? (
        <EmptyState
          emoji="🌷"
          tone="pink"
          title="Nenhum aluno por aqui ainda"
          description="Cadastre o primeiro com contato, plano de pagamento e uma cor só dele."
          action={
            <Button asChild size="lg">
              <Link href="/alunos/novo">
                <UserPlus /> Cadastrar aluno
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="sticky top-0 z-20 space-y-3 bg-background/90 px-5 pb-3 pt-1 backdrop-blur-lg">
            <Input
              type="search"
              aria-label="Buscar aluno"
              placeholder="Buscar por nome, telefone, etiqueta…"
              icon={<Search />}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              enterKeyHint="search"
              trailing={
                q ? (
                  <button
                    type="button"
                    onClick={() => setQ('')}
                    aria-label="Limpar busca"
                    className="-mr-1 grid size-8 place-items-center rounded-full bg-muted text-muted-foreground"
                  >
                    <X className="size-4" />
                  </button>
                ) : null
              }
            />
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 scrollbar-none">
              {STATUS_CHIPS.filter((c) => c.value === 'TODOS' || c.value === StudentStatus.ATIVO || counts[c.value]).map(
                (c) => (
                  <Chip
                    key={c.value}
                    active={!term && status === c.value}
                    count={counts[c.value]}
                    onClick={() => setStatus(c.value)}
                  >
                    {c.label}
                  </Chip>
                ),
              )}
              {tags.length ? <span aria-hidden className="mx-1 w-px shrink-0 bg-border" /> : null}
              {tags.map((t) => (
                <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                  #{t}
                </Chip>
              ))}
            </div>
          </div>

          <div className="px-5">
            {filtered.length ? (
              <Card className="p-1.5">
                <ul>
                  {filtered.map((s) => (
                    <li key={s.id}>
                      <StudentRow student={s} />
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <EmptyState
                emoji="🔍"
                tone="sky"
                title={term ? 'Ninguém com esse nome' : 'Ninguém aqui'}
                description={
                  term
                    ? `Não achamos "${q.trim()}". Tente parte do nome ou do telefone.`
                    : 'Nenhum aluno nesse filtro.'
                }
              />
            )}
          </div>
        </>
      )}
    </>
  );
}
