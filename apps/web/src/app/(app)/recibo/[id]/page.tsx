'use client';

import { displayName, formatBRL, formatDateLong, PAYMENT_METHOD_LABEL } from '@turmei/contracts';
import { useQuery } from '@tanstack/react-query';
import { Printer, Share2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { LogoMark } from '@/components/brand/logo';
import { FormTopBar, useBack } from '@/components/layout/form-page';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { financeApi } from '@/lib/api/finance';

export default function ReciboPage() {
  const { id } = useParams<{ id: string }>();
  const back = useBack('/financeiro');
  const { data, isPending, isError } = useQuery({ queryKey: ['receipt', id], queryFn: () => financeApi.receipt(id) });

  if (isPending) return <Skeleton className="m-5 h-96" />;
  if (isError || !data) {
    return (
      <>
        <FormTopBar onBack={back} />
        <EmptyState emoji="🧾" tone="sky" title="Recibo não encontrado" description="O pagamento pode ter sido estornado." />
      </>
    );
  }
  const { payment, charge } = data;
  const text = `Recibo nº ${payment.receiptNumber}\nRecebi de ${data.payerName} o valor de ${formatBRL(payment.amountCents)} referente a ${charge.description.toLowerCase()} (${displayName(charge.student)}), pago em ${formatDateLong(payment.paidAt)} via ${PAYMENT_METHOD_LABEL[payment.method]}.\n${data.teacherName}`;

  return (
    <>
      <div className="no-print">
        <FormTopBar onBack={back} title="Recibo" />
      </div>
      <div className="px-5 pb-8">
        <article className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-soft print:border-0 print:shadow-none">
          <div aria-hidden className="absolute -right-12 -top-12 size-40 rounded-full bg-primary-soft" />
          <div className="relative flex items-center gap-3">
            <LogoMark className="size-11" />
            <div>
              <p className="font-display text-xl font-black">Recibo</p>
              <p className="text-sm text-muted-foreground">nº {payment.receiptNumber}</p>
            </div>
          </div>
          <p className="relative mt-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Valor</p>
          <p className="relative font-display text-4xl font-black tabular">{formatBRL(payment.amountCents)}</p>
          <dl className="relative mt-6 space-y-3 text-[15px]">
            <div>
              <dt className="text-xs font-bold uppercase text-muted-foreground">Recebido de</dt>
              <dd className="font-semibold">{data.payerName}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-muted-foreground">Referente a</dt>
              <dd className="font-semibold">
                {charge.description} · {displayName(charge.student)}
              </dd>
            </div>
            <div className="flex gap-8">
              <div>
                <dt className="text-xs font-bold uppercase text-muted-foreground">Data</dt>
                <dd className="font-semibold">{formatDateLong(payment.paidAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-muted-foreground">Forma</dt>
                <dd className="font-semibold">{PAYMENT_METHOD_LABEL[payment.method]}</dd>
              </div>
            </div>
          </dl>
          <div className="relative mt-8 border-t border-dashed border-border pt-4">
            <p className="font-display text-lg font-extrabold">{data.teacherName}</p>
            <p className="text-sm text-muted-foreground">Professor(a)</p>
          </div>
        </article>
        <div className="no-print mt-5 grid grid-cols-2 gap-3">
          <Button
            variant="soft"
            onClick={async () => {
              if (navigator.share) {
                await navigator.share({ title: `Recibo ${payment.receiptNumber}`, text }).catch(() => undefined);
              } else {
                await navigator.clipboard?.writeText(text);
                toast('Recibo copiado 📋');
              }
            }}
          >
            <Share2 /> Compartilhar
          </Button>
          <Button variant="soft" onClick={() => window.print()}>
            <Printer /> PDF / imprimir
          </Button>
        </div>
      </div>
    </>
  );
}
