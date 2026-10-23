'use client';

import {
  BillingPlanType,
  displayName,
  formatBRL,
  PAYMENT_METHOD_LABEL,
  PaymentMethod,
  PayerBadge,
  PLAN_TYPE_LABEL,
  type ReportFilters,
} from '@aulinha/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Download, SlidersHorizontal, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { toast } from 'sonner';
import { HorizontalBars, MonthColumns, StatTile } from '@/components/reports/charts';
import { StudentAvatar } from '@/components/students/student-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { SwitchRow } from '@/components/ui/switch-row';
import { reportsApi } from '@/lib/api/reports';
import { useStudents } from '@/lib/queries/students';
import { PERIODS, periodRange } from '@/lib/reports-period';
import { useTagSuggestions } from '@/lib/students/use-tag-suggestions';
import { useToday } from '@/lib/use-today';
import { cn } from '@/lib/utils';

type Tab = 'geral' | 'atrasos' | 'frequencia';

const BADGE: Record<PayerBadge, { label: string; icon: string; cls: string }> = {
  EM_DIA: { label: 'Em dia', icon: '🟢', cls: 'bg-success-soft text-success-soft-foreground' },
  AS_VEZES: { label: 'Às vezes atrasa', icon: '🟡', cls: 'bg-warning-soft text-warning-soft-foreground' },
  SEMPRE: { label: 'Atrasa sempre', icon: '🔴', cls: 'bg-danger-soft text-danger-soft-foreground' },
};

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

function useFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const today = useToday();
  const period = params.get('periodo') ?? '3-meses';
  const custom = { from: params.get('de') ?? undefined, to: params.get('ate') ?? undefined };
  const range = today ? periodRange(period, today, custom) : null;
  const filters: ReportFilters | null = range
    ? {
        ...range,
        studentIds: list(params.get('alunos')),
        tags: list(params.get('tags')),
        methods: list(params.get('formas')) as PaymentMethod[],
        planTypes: list(params.get('planos')) as BillingPlanType[],
        onlyLate: params.get('atrasos') === '1',
      }
    : null;
  const tab = (params.get('aba') as Tab) ?? 'geral';

  /** Filtros vivem na URL: dá para voltar, recarregar e salvar. */
  const set = (patch: Record<string, string | string[] | boolean | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      const value = Array.isArray(v) ? v.join(',') : typeof v === 'boolean' ? (v ? '1' : '') : (v ?? '');
      if (value) next.set(k, value);
      else next.delete(k);
    }
    router.replace(`/relatorios?${next}`, { scroll: false });
  };
  const activeCount =
    (filters?.studentIds?.length ? 1 : 0) +
    (filters?.tags?.length ? 1 : 0) +
    (filters?.methods?.length ? 1 : 0) +
    (filters?.planTypes?.length ? 1 : 0) +
    (filters?.onlyLate ? 1 : 0);
  return { period, custom, filters, tab, set, activeCount, params };
}

function toggle<T>(arr: T[] | undefined, v: T): T[] {
  const a = arr ?? [];
  return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
}

function FilterSheet({
  open,
  onOpenChange,
  filters,
  set,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filters: ReportFilters;
  set: ReturnType<typeof useFilters>['set'];
}) {
  const { data: students } = useStudents();
  const tags = useTagSuggestions();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Filtros" description="Combine como quiser — tudo atualiza na hora.">
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="pl-1 text-sm font-semibold">Alunos</p>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {(students ?? []).map((s) => (
              <Chip key={s.id} active={filters.studentIds?.includes(s.id)} onClick={() => set({ alunos: toggle(filters.studentIds, s.id) })}>
                {s.emoji ?? '•'} {displayName(s)}
              </Chip>
            ))}
          </div>
        </div>
        {tags.length ? (
          <div className="space-y-2">
            <p className="pl-1 text-sm font-semibold">Etiquetas</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Chip key={t} active={filters.tags?.includes(t)} onClick={() => set({ tags: toggle(filters.tags, t) })}>
                  #{t}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}
        <div className="space-y-2">
          <p className="pl-1 text-sm font-semibold">Forma de pagamento</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(PaymentMethod).map((m) => (
              <Chip key={m} active={filters.methods?.includes(m)} onClick={() => set({ formas: toggle(filters.methods, m) })}>
                {PAYMENT_METHOD_LABEL[m]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="pl-1 text-sm font-semibold">Tipo de plano</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(BillingPlanType).map((p) => (
              <Chip key={p} active={filters.planTypes?.includes(p)} onClick={() => set({ planos: toggle(filters.planTypes, p) })}>
                {PLAN_TYPE_LABEL[p]}
              </Chip>
            ))}
          </div>
        </div>
        <SwitchRow
          id="only-late"
          checked={!!filters.onlyLate}
          onCheckedChange={(v) => set({ atrasos: v })}
          title="Só o que atrasou"
          description="Cobranças pagas com atraso ou em atraso."
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" onClick={() => set({ alunos: null, tags: null, formas: null, planos: null, atrasos: null })}>
            Limpar
          </Button>
          <Button onClick={() => onOpenChange(false)}>Ver resultado</Button>
        </div>
      </div>
    </Sheet>
  );
}

function RelatoriosInner() {
  const { period, custom, filters, tab, set, activeCount, params } = useFilters();
  const qc = useQueryClient();
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [filterName, setFilterName] = React.useState('');
  const [exporting, setExporting] = React.useState(false);
  const key = filters ? JSON.stringify(filters) : '';
  const summary = useQuery({ queryKey: ['reports', 'summary', key], queryFn: () => reportsApi.summary(filters!), enabled: !!filters, placeholderData: (p) => p });
  const late = useQuery({ queryKey: ['reports', 'late', key], queryFn: () => reportsApi.latePayers(filters!), enabled: !!filters && tab === 'atrasos', placeholderData: (p) => p });
  const attendance = useQuery({ queryKey: ['reports', 'attendance', key], queryFn: () => reportsApi.attendance(filters!), enabled: !!filters && tab === 'frequencia', placeholderData: (p) => p });
  const saved = useQuery({ queryKey: ['reports', 'saved'], queryFn: reportsApi.filters });
  const removeSaved = useMutation({ mutationFn: reportsApi.removeFilter, onSuccess: () => qc.invalidateQueries({ queryKey: ['reports', 'saved'] }) });

  if (!filters) return <Skeleton className="m-5 h-96" />;
  const s = summary.data;

  const applySaved = (f: NonNullable<typeof saved.data>[number]) => {
    const c = f.criteria;
    set({
      periodo: f.period,
      de: c.from ?? null,
      ate: c.to ?? null,
      alunos: c.studentIds ?? null,
      tags: c.tags ?? null,
      formas: c.methods ?? null,
      planos: c.planTypes ?? null,
      atrasos: !!c.onlyLate,
    });
  };

  const exportCsv = async (type: string) => {
    setExporting(true);
    try {
      await reportsApi.exportCsv(type, filters);
      toast.success('Planilha baixada 📊');
    } catch {
      toast.error('Não foi possível exportar');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <header className="flex items-end justify-between gap-3 px-5 pb-3 pt-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {filters.from.split('-').reverse().join('/')} → {filters.to.split('-').reverse().join('/')}
          </p>
          <h1 className="text-3xl font-black">Relatórios</h1>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <Button size="sm" variant="soft" loading={exporting}>
              <Download className="!size-4" /> CSV
            </Button>
          </MenuTrigger>
          <MenuContent>
            {[
              ['pagamentos', 'Pagamentos recebidos'],
              ['cobrancas', 'Cobranças'],
              ['atrasos', 'Ranking de atrasos'],
              ['frequencia', 'Frequência'],
              ['aulas', 'Todas as aulas'],
            ].map(([t, l]) => (
              <MenuItem key={t} onSelect={() => exportCsv(t)}>
                {l}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </header>

      <div className="sticky top-0 z-20 space-y-2.5 bg-background/90 px-5 pb-3 pt-1 backdrop-blur-lg">
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 scrollbar-none">
          {PERIODS.map((p) => (
            <Chip key={p.v} active={period === p.v} onClick={() => set({ periodo: p.v })}>
              {p.l}
            </Chip>
          ))}
        </div>
        {period === 'personalizado' ? (
          <div className="grid grid-cols-2 gap-2">
            <Input aria-label="De" type="date" value={custom.from ?? filters.from} onChange={(e) => set({ de: e.target.value })} />
            <Input aria-label="Até" type="date" value={custom.to ?? filters.to} onChange={(e) => set({ ate: e.target.value })} />
          </div>
        ) : null}
        <div className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 scrollbar-none">
          <Chip active={activeCount > 0} count={activeCount || undefined} onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="size-4" /> Filtros
          </Chip>
          {(saved.data ?? []).map((f) => (
            <span key={f.id} className="inline-flex shrink-0 items-center rounded-full border border-border bg-card">
              <button type="button" onClick={() => applySaved(f)} className="flex h-9 items-center gap-1.5 pl-3.5 pr-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
                <Bookmark className="size-3.5" /> {f.name}
              </button>
              <button type="button" aria-label={`Apagar filtro ${f.name}`} onClick={() => removeSaved.mutate(f.id)} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => setSaveOpen(true)} className="h-9 shrink-0 rounded-full border border-dashed border-border px-3.5 text-sm font-semibold text-muted-foreground">
            + Salvar filtro
          </button>
        </div>
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1.5">
          {(
            [
              ['geral', 'Visão geral'],
              ['atrasos', 'Atrasos'],
              ['frequencia', 'Frequência'],
            ] as [Tab, string][]
          ).map(([v, l]) => (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={tab === v}
              onClick={() => set({ aba: v === 'geral' ? null : v })}
              className={cn('rounded-xl py-2 text-sm font-bold transition-all', tab === v ? 'bg-card shadow-soft' : 'text-muted-foreground')}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5 px-5 pb-6">
        {tab === 'geral' ? (
          !s ? (
            <Skeleton className="h-96" />
          ) : (
            <div className={cn('space-y-5 transition-opacity', summary.isFetching && 'opacity-70')}>
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Recebido" value={formatBRL(s.receivedCents)} sub={`${s.paymentsCount} pagamentos`} tone="success" />
                <StatTile label="Previsto" value={formatBRL(s.expectedCents)} sub={s.expectedCents ? `${Math.round((s.receivedCents / s.expectedCents) * 100)}% recebido` : undefined} />
                <StatTile label="Em aberto" value={formatBRL(s.openCents)} />
                <StatTile label="Em atraso" value={formatBRL(s.overdueCents)} tone={s.overdueCents ? 'danger' : undefined} />
              </div>

              {s.byMonth.length > 1 ? (
                <Card>
                  <h2 className="mb-3 font-display text-lg font-extrabold">Por mês</h2>
                  <MonthColumns data={s.byMonth} />
                </Card>
              ) : null}

              <Card>
                <h2 className="mb-3 font-display text-lg font-extrabold">Aulas no período</h2>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ['✓ Realizadas', s.lessons.realized, 'bg-success-soft text-success-soft-foreground'],
                    ['✗ Faltas do aluno', s.lessons.studentAbsences, 'bg-danger-soft text-danger-soft-foreground'],
                    ['⚠︎ Suas faltas', s.lessons.teacherAbsences, 'bg-warning-soft text-warning-soft-foreground'],
                    ['⊘ Canceladas', s.lessons.canceled, 'bg-muted text-muted-foreground'],
                  ].map(([l, v, cls]) => (
                    <div key={l as string} className={cn('rounded-2xl px-3 py-2.5', cls as string)}>
                      <p className="font-display text-xl font-black tabular">{v as number}</p>
                      <p className="text-xs font-semibold">{l as string}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {s.byMethod.length ? (
                <Card>
                  <h2 className="mb-3 font-display text-lg font-extrabold">Formas de pagamento</h2>
                  <HorizontalBars
                    rows={s.byMethod.map((m) => ({ key: m.method, label: `${PAYMENT_METHOD_LABEL[m.method]} · ${m.count}x`, value: m.cents }))}
                  />
                </Card>
              ) : null}

              {s.byStudent.length ? (
                <Card>
                  <h2 className="mb-3 font-display text-lg font-extrabold">Por aluno</h2>
                  <HorizontalBars
                    rows={s.byStudent.map((r) => ({
                      key: r.student.id,
                      label: (
                        <span className="flex items-center gap-2">
                          <span aria-hidden>{r.student.emoji ?? '•'}</span>
                          {displayName(r.student)}
                          {r.openCents ? <span className="text-xs font-semibold text-danger"> · {formatBRL(r.openCents)} em aberto</span> : null}
                        </span>
                      ),
                      value: r.receivedCents,
                    }))}
                  />
                </Card>
              ) : null}

              {!s.paymentsCount && !s.expectedCents ? (
                <EmptyState emoji="📊" tone="primary" title="Sem dados no período" description="Mude o período ou os filtros." />
              ) : null}
            </div>
          )
        ) : tab === 'atrasos' ? (
          !late.data ? (
            <Skeleton className="h-96" />
          ) : late.data.length ? (
            <div className="space-y-2.5">
              <p className="px-1 text-sm text-muted-foreground">
                Ordenado por quem mais atrasa: frequência, média de dias e o que está em aberto hoje.
              </p>
              {late.data.map((r, i) => (
                <Card key={r.student.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-center font-display font-black text-muted-foreground">{i + 1}</span>
                    <StudentAvatar name={r.student.name} color={r.student.color} emoji={r.student.emoji} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-extrabold">{displayName(r.student)}</p>
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', BADGE[r.badge].cls)}>
                        <span aria-hidden>{BADGE[r.badge].icon}</span> {BADGE[r.badge].label}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl font-black tabular">{r.score}</p>
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">pontos</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-xl bg-muted/70 py-2">
                      <p className="font-bold tabular">{r.latePct}%</p>
                      <p className="text-[11px] text-muted-foreground">com atraso ({r.lateCount}/{r.chargesCount})</p>
                    </div>
                    <div className="rounded-xl bg-muted/70 py-2">
                      <p className="font-bold tabular">{String(r.avgDaysLate).replace('.', ',')} d</p>
                      <p className="text-[11px] text-muted-foreground">média (máx {r.maxDaysLate})</p>
                    </div>
                    <div className={cn('rounded-xl py-2', r.overdueCents ? 'bg-danger-soft text-danger-soft-foreground' : 'bg-muted/70')}>
                      <p className="font-bold tabular">{formatBRL(r.overdueCents)}</p>
                      <p className="text-[11px]">em atraso hoje</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState emoji="🌈" tone="success" title="Ninguém atrasou" description="Nenhum atraso no período e filtros escolhidos." />
          )
        ) : !attendance.data ? (
          <Skeleton className="h-96" />
        ) : attendance.data.length ? (
          <Card className="space-y-4">
            <p className="text-sm text-muted-foreground">Presença = realizadas ÷ (realizadas + faltas do aluno). Menor presença primeiro.</p>
            {attendance.data.map((r) => (
              <div key={r.student.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <StudentAvatar name={r.student.name} color={r.student.color} emoji={r.student.emoji} size="sm" className="size-8 rounded-xl text-sm" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{displayName(r.student)}</span>
                  <span className="font-display font-black tabular">{r.rate}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full" style={{ width: `${r.rate}%`, background: 'var(--chart-1)' }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.realized} realizadas · {r.studentAbsences} faltas{r.justifiedAbsences ? ` (${r.justifiedAbsences} justif.)` : ''} · {r.teacherAbsences} suas
                  {r.canceled ? ` · ${r.canceled} canceladas` : ''}
                </p>
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState emoji="🗓️" tone="primary" title="Sem aulas marcadas" description="Nenhuma aula marcada no período." />
        )}
      </div>

      <FilterSheet open={filtersOpen} onOpenChange={setFiltersOpen} filters={filters} set={set} />
      <Sheet open={saveOpen} onOpenChange={setSaveOpen} title="Salvar filtro" description="Vira um atalho no topo dos relatórios.">
        <div className="space-y-4">
          <Field label="Nome" htmlFor="sf-name">
            <Input id="sf-name" value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Inadimplentes do trimestre" />
          </Field>
          <Button
            block
            size="lg"
            onClick={async () => {
              if (!filterName.trim()) return;
              await reportsApi.saveFilter({
                name: filterName.trim(),
                period,
                criteria: {
                  ...(period === 'personalizado' ? { from: filters.from, to: filters.to } : {}),
                  studentIds: filters.studentIds,
                  tags: filters.tags,
                  methods: filters.methods,
                  planTypes: filters.planTypes,
                  onlyLate: filters.onlyLate,
                },
              });
              qc.invalidateQueries({ queryKey: ['reports', 'saved'] });
              toast.success('Filtro salvo 🔖');
              setFilterName('');
              setSaveOpen(false);
            }}
          >
            Salvar
          </Button>
          <p className="text-xs text-muted-foreground">Período: {PERIODS.find((p) => p.v === period)?.l}. {params.toString() ? 'Inclui os filtros escolhidos.' : ''}</p>
        </div>
      </Sheet>
    </>
  );
}

export default function RelatoriosPage() {
  return (
    <Suspense>
      <RelatoriosInner />
    </Suspense>
  );
}
