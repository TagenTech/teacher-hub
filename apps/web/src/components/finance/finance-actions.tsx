'use client';

import * as React from 'react';
import { ChargeSheet } from './charge-sheet';
import { NewChargeSheet } from './new-charge-sheet';

interface FinanceActions {
  openCharge: (id: string, step?: 'details' | 'pay') => void;
  openNewCharge: (studentId?: string) => void;
}

const Ctx = React.createContext<FinanceActions | null>(null);

export function useFinanceActions() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useFinanceActions precisa de <FinanceActionsProvider>');
  return ctx;
}

export function FinanceActionsProvider({ children }: { children: React.ReactNode }) {
  const [charge, setCharge] = React.useState<{ id: string; step: 'details' | 'pay' } | null>(null);
  const [newCharge, setNewCharge] = React.useState<{ studentId?: string } | null>(null);
  const value = React.useMemo<FinanceActions>(
    () => ({
      openCharge: (id, step = 'details') => setCharge({ id, step }),
      openNewCharge: (studentId) => setNewCharge({ studentId }),
    }),
    [],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      <ChargeSheet chargeId={charge?.id ?? null} initialStep={charge?.step ?? 'details'} onClose={() => setCharge(null)} />
      <NewChargeSheet prefill={newCharge} onClose={() => setNewCharge(null)} />
    </Ctx.Provider>
  );
}
