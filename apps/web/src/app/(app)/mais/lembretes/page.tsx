'use client';

import { formatDuration, LESSON_REMINDER_OPTIONS } from '@turmei/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarCheck, Copy, RefreshCw, Smartphone, Volume2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { chime, INAPP_ALARM_KEY } from '@/components/agenda/alarm-watcher';
import { FormTopBar, useBack } from '@/components/layout/form-page';
import { InstallCard } from '@/components/pwa/install-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { SwitchRow } from '@/components/ui/switch-row';
import { ApiError } from '@/lib/api/client';
import { financeApi } from '@/lib/api/finance';
import { remindersApi } from '@/lib/api/reminders';
import { useAuth } from '@/lib/auth';
import { currentPushState, disablePush, enablePush, type PushState } from '@/lib/push';
import { useHydrated } from '@/lib/use-hydrated';
import { cn, haptic } from '@/lib/utils';

const HOURS = [7, 8, 9, 10, 12, 18, 20];

function Section({ icon: Icon, title, children }: { icon: typeof BellRing; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-4" /> {title}
      </h2>
      <Card className="space-y-4">{children}</Card>
    </section>
  );
}

function readInApp() {
  try {
    return localStorage.getItem(INAPP_ALARM_KEY) !== 'off';
  } catch {
    return true;
  }
}

export default function LembretesPage() {
  const back = useBack('/mais');
  const hydrated = useHydrated();
  const qc = useQueryClient();
  const { teacher, setTeacher } = useAuth();
  const { data: status } = useQuery({ queryKey: ['push', 'status'], queryFn: remindersApi.status });
  const { data: feed } = useQuery({ queryKey: ['calendar', 'feed'], queryFn: remindersApi.feed });
  const { data: pushState, refetch: refetchPush } = useQuery({
    queryKey: ['push', 'state'],
    queryFn: currentPushState,
    enabled: hydrated,
  });
  const [busy, setBusy] = React.useState(false);
  const [inAppPicked, setInApp] = React.useState<boolean | null>(null);
  const inApp = inAppPicked ?? (hydrated ? readInApp() : true);

  const saveSetting = async (body: { lessonReminderMinutes?: number; paymentReminderHour?: number }) => {
    try {
      setTeacher(await financeApi.updateSettings(body));
      haptic(8);
      qc.invalidateQueries({ queryKey: ['calendar'] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar');
    }
  };

  const toggle = async () => {
    if (!status?.publicKey) {
      toast.error('Notificações não configuradas no servidor (VAPID).');
      return;
    }
    setBusy(true);
    try {
      const next: PushState = pushState === 'on' ? await disablePush() : await enablePush(status.publicKey);
      if (next === 'on') toast.success('Notificações ativadas neste aparelho 🔔');
      if (next === 'denied') toast.error('Permissão negada — libere nas configurações do navegador.');
      await refetchPush();
      qc.invalidateQueries({ queryKey: ['push', 'status'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível ativar');
    } finally {
      setBusy(false);
    }
  };

  const google = feed ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feed.webcalUrl)}` : '#';

  return (
    <>
      <FormTopBar onBack={back} title="Lembretes e alarmes" />
      <div className="space-y-6 px-5 pb-8">
        <Section icon={BellRing} title="Antes de cada aula">
          <div className="flex flex-wrap gap-1.5">
            {LESSON_REMINDER_OPTIONS.map((m) => (
              <Chip key={m} active={teacher?.lessonReminderMinutes === m} onClick={() => saveSetting({ lessonReminderMinutes: m })}>
                {m === 0 ? 'Desligado' : formatDuration(m) + ' antes'}
              </Chip>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Vale para a notificação, o alarme do calendário e o aviso com o app aberto.</p>
        </Section>

        <Section icon={Smartphone} title="Notificações neste aparelho">
          {pushState === 'needs-install' ? (
            <>
              <p className="text-sm">No iPhone, as notificações só funcionam com o Turmei instalado na Tela de Início (iOS 16.4+).</p>
              <InstallCard dismissible={false} />
            </>
          ) : pushState === 'unsupported' ? (
            <p className="text-sm text-muted-foreground">Este navegador não suporta notificações. Use o calendário abaixo para ter alarme. ⬇️</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'grid size-12 place-items-center rounded-2xl',
                    pushState === 'on' ? 'bg-success-soft text-success-soft-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <BellRing className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-extrabold">
                    {pushState === 'on' ? 'Ativadas' : pushState === 'denied' ? 'Bloqueadas' : 'Desativadas'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {pushState === 'denied'
                      ? 'Libere nas configurações do navegador/celular.'
                      : 'Aula chegando, resumo do dia às 7h, pagamentos e aniversários.'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Button variant={pushState === 'on' ? 'outline' : 'primary'} loading={busy} disabled={pushState === 'denied'} onClick={toggle}>
                  {pushState === 'on' ? 'Desativar' : 'Ativar'}
                </Button>
                <Button
                  variant="soft"
                  disabled={pushState !== 'on'}
                  onClick={async () => {
                    const r = await remindersApi.test().catch(() => null);
                    toast(r?.delivered ? 'Notificação de teste enviada 🔔' : 'Nenhum aparelho recebeu — tente ativar de novo.');
                  }}
                >
                  Testar
                </Button>
              </div>
              {status?.devices.length ? (
                <p className="text-xs text-muted-foreground">
                  Aparelhos: {status.devices.map((d) => d.deviceLabel ?? 'Navegador').join(', ')}
                </p>
              ) : null}
            </>
          )}
        </Section>

        <Section icon={CalendarCheck} title="Alarme no calendário do celular">
          <p className="text-sm">
            O jeito mais confiável de ter <strong>alarme</strong>: assine sua agenda no calendário do celular. Cada aula toca
            sozinha, mesmo com o app fechado e sem internet.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <Button asChild variant="soft" disabled={!feed}>
              <a href={feed?.webcalUrl ?? '#'}>iPhone / Mac</a>
            </Button>
            <Button asChild variant="soft" disabled={!feed}>
              <a href={google} target="_blank" rel="noreferrer">
                Google Agenda
              </a>
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (!feed) return;
                await navigator.clipboard?.writeText(feed.url);
                toast('Link copiado 📋');
              }}
            >
              <Copy className="!size-4" /> Copiar link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await remindersApi.rotateFeed();
                qc.invalidateQueries({ queryKey: ['calendar'] });
                toast('Novo link gerado — o antigo parou de funcionar');
              }}
            >
              <RefreshCw className="!size-4" /> Gerar novo link
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Não compartilhe este link: ele mostra sua agenda.</p>
        </Section>

        <Section icon={Volume2} title="Com o app aberto">
          <SwitchRow
            id="inapp"
            checked={inApp}
            onCheckedChange={(v) => {
              setInApp(v);
              try {
                localStorage.setItem(INAPP_ALARM_KEY, v ? 'on' : 'off');
              } catch {
                /* ignora */
              }
              if (v) chime();
            }}
            title="Tocar um som e vibrar"
            description="Quando a aula estiver chegando e o Turmei estiver aberto."
          />
        </Section>

        <Section icon={BellRing} title="Lembrete de pagamento">
          <p className="text-sm text-muted-foreground">Avisar 1 dia antes do vencimento e no dia seguinte ao atraso, às:</p>
          <div className="flex flex-wrap gap-1.5">
            {HOURS.map((h) => (
              <Chip key={h} active={teacher?.paymentReminderHour === h} onClick={() => saveSetting({ paymentReminderHour: h })}>
                {h}h
              </Chip>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}
