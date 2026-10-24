'use client';

import { initials } from '@turmei/contracts';
import {
  BarChart3,
  BellRing,
  CalendarOff,
  ChevronRight,
  Download,
  KeyRound,
  LogOut,
  RefreshCw,
  Settings2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { InstallCard } from '@/components/pwa/install-card';
import { ChangePasswordSheet } from '@/components/settings/change-password-sheet';
import { ThemePicker } from '@/components/settings/theme-picker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { useMakeups } from '@/lib/queries/agenda';

function Row({
  icon: Icon,
  label,
  hint,
  href,
  onClick,
  tone = 'bg-primary-soft text-primary-soft-foreground',
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  href?: string;
  onClick?: () => void;
  tone?: string;
}) {
  const body = (
    <>
      <span className={`grid size-11 place-items-center rounded-2xl ${tone}`}>
        <Icon className="size-5" />
      </span>
      <span className="flex-1 font-semibold">{label}</span>
      {hint ? (
        <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-bold text-warning-soft-foreground">{hint}</span>
      ) : null}
      <ChevronRight className="size-5 text-muted-foreground" />
    </>
  );
  const cls = 'flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-muted active:bg-muted';
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <Card className="p-2">{children}</Card>
    </section>
  );
}

export default function MaisPage() {
  const { teacher, logout } = useAuth();
  const { data: makeups } = useMakeups({ status: 'ABERTO' });
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  return (
    <>
      <PageHeader title="Mais" />
      <div className="space-y-5 px-5">
        {teacher ? (
          <Link href="/mais/perfil" className="block">
            <Card className="flex items-center gap-4 transition-colors hover:bg-muted">
              <span className="grid size-16 shrink-0 place-items-center rounded-[1.4rem] bg-gradient-to-br from-[#8f7cf8] to-[#f28db8] font-display text-2xl font-black text-white">
                {initials(teacher.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl font-extrabold">{teacher.name}</p>
                <p className="truncate text-muted-foreground">{teacher.email}</p>
                {!teacher.profileComplete ? (
                  <span className="mt-1 inline-block rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold text-primary-soft-foreground">
                    ✨ Finalizar cadastro
                  </span>
                ) : null}
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Card>
          </Link>
        ) : null}

        <InstallCard dismissible={false} />

        <Group title="Gestão">
          <Row icon={BarChart3} label="Relatórios" href="/relatorios" tone="bg-success-soft text-success-soft-foreground" />
          <Row
            icon={RefreshCw}
            label="Reposições"
            href="/mais/reposicoes"
            hint={makeups?.length ? String(makeups.length) : undefined}
            tone="bg-sky-soft text-[var(--stu-ceu-fg)]"
          />
          <Row icon={CalendarOff} label="Bloqueios de agenda" href="/mais/bloqueios" tone="bg-peach-soft text-[var(--stu-pessego-fg)]" />
        </Group>

        <Group title="Configurações">
          <Row icon={Settings2} label="Ajustes e PIX" href="/mais/ajustes" />
          <Row icon={BellRing} label="Lembretes e alarmes" href="/mais/lembretes" tone="bg-warning-soft text-warning-soft-foreground" />
          <Row icon={Download} label="Exportar meus dados" href="/mais/dados" />
          <Row icon={ShieldCheck} label="Segurança da conta" href="/mais/seguranca" hint={teacher && !teacher.mfaEnabled ? '2FA' : undefined} tone="bg-success-soft text-success-soft-foreground" />
          <Row icon={KeyRound} label={teacher?.hasPassword === false ? 'Criar senha' : 'Alterar senha'} onClick={() => setPasswordOpen(true)} />
        </Group>

        <section>
          <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Aparência</h2>
          <ThemePicker />
        </section>

        <Button
          variant="danger"
          block
          loading={leaving}
          onClick={async () => {
            setLeaving(true);
            await logout();
          }}
        >
          <LogOut /> Sair
        </Button>

        <p className="pb-2 text-center text-xs text-muted-foreground">Turmei · versão 1.0</p>
      </div>
      <ChangePasswordSheet open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  );
}
