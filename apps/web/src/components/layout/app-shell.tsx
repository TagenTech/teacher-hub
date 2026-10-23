'use client';

import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { AlarmWatcher } from '@/components/agenda/alarm-watcher';
import { LessonActionsProvider } from '@/components/agenda/lesson-actions';
import { LogoMark } from '@/components/brand/logo';
import { FinanceActionsProvider } from '@/components/finance/finance-actions';
import { useAuth } from '@/lib/auth';
import { BottomNav } from './bottom-nav';
import { ConnectivityBanner } from './connectivity-banner';
import { QuickActions } from './quick-actions';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  // Telas de formulário ocupam a tela toda, sem barra inferior.
  const immersive = /\/(novo|editar)$|^\/mais\/(perfil|ajustes)$/.test(usePathname());

  React.useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Carregando">
        <LogoMark className="size-16 animate-pulse" />
      </div>
    );
  }

  return (
    <LessonActionsProvider>
    <FinanceActionsProvider>
    <div className="min-h-dvh pt-safe">
      <ConnectivityBanner />
      <AlarmWatcher />
      {immersive ? (
        <main className="mx-auto max-w-lg">{children}</main>
      ) : (
        <>
          <main className="mx-auto max-w-lg pb-[calc(6.5rem+env(safe-area-inset-bottom))]">{children}</main>
          <QuickActions />
          <BottomNav />
        </>
      )}
    </div>
    </FinanceActionsProvider>
    </LessonActionsProvider>
  );
}
