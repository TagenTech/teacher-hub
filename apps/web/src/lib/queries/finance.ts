'use client';

import type { ChargeDto, CreateChargeRequest, RegisterPaymentRequest, UpdateChargeRequest } from '@aulinha/contracts';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { financeApi, type ChargeFilter } from '@/lib/api/finance';

export const financeKeys = {
  charges: (p: object) => ['charges', p] as const,
  charge: (id: string) => ['charges', 'one', id] as const,
  summary: (month: string) => ['finance', 'summary', month] as const,
  highlights: ['finance', 'highlights'] as const,
  preview: (studentId: string) => ['finance', 'preview', studentId] as const,
};

export const useCharges = (p: { month?: string; studentId?: string; status?: ChargeFilter }, enabled = true) =>
  useQuery({ queryKey: financeKeys.charges(p), queryFn: () => financeApi.charges(p), enabled, placeholderData: (prev) => prev });
export function useCharge(id: string | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: financeKeys.charge(id ?? ''),
    queryFn: () => financeApi.charge(id!),
    enabled: !!id,
    // Abre na hora com o que já está nas listas; mantém o anterior enquanto a folha fecha.
    initialData: () => {
      if (!id) return undefined;
      for (const [, data] of qc.getQueriesData<unknown>({ queryKey: ['charges'] })) {
        const list = Array.isArray(data) ? (data as ChargeDto[]) : [];
        const hit = list.find((c) => c.id === id);
        if (hit) return hit;
      }
      const hl = qc.getQueryData<{ dueSoon: ChargeDto[]; overdue: ChargeDto[] }>(financeKeys.highlights);
      return hl ? [...hl.dueSoon, ...hl.overdue].find((c) => c.id === id) : undefined;
    },
    initialDataUpdatedAt: 0,
    placeholderData: (prev) => prev,
  });
}
export const useMonthSummary = (month: string | null) =>
  useQuery({ queryKey: financeKeys.summary(month ?? ''), queryFn: () => financeApi.summary(month!), enabled: !!month, placeholderData: (prev) => prev });
export const useFinanceHighlights = () => useQuery({ queryKey: financeKeys.highlights, queryFn: financeApi.highlights });
export const useBillingPreview = (studentId: string) =>
  useQuery({ queryKey: financeKeys.preview(studentId), queryFn: () => financeApi.preview(studentId) });

export function invalidateFinance(qc: QueryClient, charge?: ChargeDto) {
  if (charge) qc.setQueryData(financeKeys.charge(charge.id), charge);
  qc.invalidateQueries({ queryKey: ['charges'] });
  qc.invalidateQueries({ queryKey: ['finance'] });
  qc.invalidateQueries({ queryKey: ['reports'] });
}

function useChargeMutation<V>(fn: (v: V) => Promise<ChargeDto>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (c) => invalidateFinance(qc, c) });
}

export const useCreateCharge = () => useChargeMutation((b: CreateChargeRequest) => financeApi.create(b));
export const useUpdateCharge = () =>
  useChargeMutation(({ id, body }: { id: string; body: UpdateChargeRequest }) => financeApi.update(id, body));
export const useCancelCharge = () => useChargeMutation((id: string) => financeApi.cancel(id));
export const useReopenCharge = () => useChargeMutation((id: string) => financeApi.reopen(id));
export const usePay = () =>
  useChargeMutation(({ id, body }: { id: string; body: RegisterPaymentRequest }) => financeApi.pay(id, body));
export const useRemovePayment = () => useChargeMutation((paymentId: string) => financeApi.removePayment(paymentId));

export function useRemoveCharge() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => financeApi.remove(id), onSuccess: () => invalidateFinance(qc) });
}

export function useCloseMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, month }: { studentId: string; month: string }) => financeApi.closeMonth(studentId, month),
    onSuccess: () => invalidateFinance(qc),
  });
}
