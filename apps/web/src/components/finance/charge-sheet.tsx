'use client';

import {
  ChargeKind,
  ChargeStatus,
  displayName,
  formatBRL,
  formatDateShort,
  PAYMENT_METHOD_LABEL,
  type ChargeDto,
} from '@aulinha/contracts';
import { Ban, HandCoins, Pencil, ReceiptText, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { StudentAvatar } from '@/components/students/student-avatar';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Sheet } from '@/components/ui/sheet';
import { ApiError } from '@/lib/api/client';
import {
  useCancelCharge,
  useCharge,
  useRemoveCharge,
  useRemovePayment,
  useReopenCharge,
  useUpdateCharge,
} from '@/lib/queries/finance';
import { useToday } from '@/lib/use-today';
import { ChargeStatusBadge } from './charge-status';
import { dueLabel } from './charge-row';
import { PaymentForm } from './payment-form';
import { CopyMessageButton, WhatsappChargeButton } from './whatsapp-button';

type Step = 'details' | 'pay' | 'edit';
const errMsg = (err: unknown, f: string) => (err instanceof ApiError ? (err.details?.[0] ?? err.message) : f);

function EditForm({ charge, onDone }: { charge: ChargeDto; onDone: () => void }) {
  const update = useUpdateCharge();
  const [description, setDescription] = React.useState(charge.description);
  const [amount, setAmount] = React.useState<number | null>(charge.amountCents);
  const [discount, setDiscount] = React.useState<number | null>(charge.discountCents || null);
  const [due, setDue] = React.useState(charge.dueDate);
  return (
    <div className="space-y-4">
      <Field label="Descrição" htmlFor="ch-desc">
        <Input id="ch-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor" htmlFor="ch-amount">
          <MoneyInput id="ch-amount" value={amount} onChange={setAmount} />
        </Field>
        <Field label="Desconto" htmlFor="ch-discount">
          <MoneyInput id="ch-discount" value={discount} onChange={setDiscount} />
        </Field>
      </div>
      <Field label="Vencimento" htmlFor="ch-due">
        <Input id="ch-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <Button
        block
        size="lg"
        loading={update.isPending}
        onClick={() =>
          update.mutate(
            {
              id: charge.id,
              body: { description: description.trim(), amountCents: amount ?? charge.amountCents, discountCents: discount ?? 0, dueDate: due },
            },
            { onSuccess: () => (toast.success('Cobrança atualizada'), onDone()), onError: (err) => toast.error(errMsg(err, 'Não foi possível salvar')) },
          )
        }
      >
        Salvar
      </Button>
    </div>
  );
}

export function ChargeSheet({ chargeId, initialStep, onClose }: { chargeId: string | null; initialStep: 'details' | 'pay'; onClose: () => void }) {
  const today = useToday();
  const { data: c } = useCharge(chargeId);
  const cancel = useCancelCharge();
  const reopen = useReopenCharge();
  const remove = useRemoveCharge();
  const removePayment = useRemovePayment();
  const [step, setStep] = React.useState<Step>(initialStep);
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);
  if (chargeId && openedFor !== chargeId + initialStep) {
    setOpenedFor(chargeId + initialStep);
    setStep(initialStep);
  }

  const open = !!chargeId;
  const isOpen = c && (c.status === ChargeStatus.PENDENTE || c.status === ChargeStatus.PARCIAL || c.status === ChargeStatus.ATRASADO);
  const title = step === 'pay' ? 'Registrar pagamento' : step === 'edit' ? 'Editar cobrança' : 'Cobrança';

  return (
    <Sheet open={open} onOpenChange={(o) => !o && (setOpenedFor(null), onClose())} title={title}>
      {!c || !today ? (
        <div className="h-48 animate-pulse rounded-3xl bg-muted" />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <StudentAvatar name={c.student.name} color={c.student.color} emoji={c.student.emoji} />
            <div className="min-w-0 flex-1">
              <Link href={`/alunos/${c.student.id}`} onClick={onClose} className="block truncate font-display text-lg font-extrabold hover:underline">
                {displayName(c.student)}
              </Link>
              <p className="truncate text-sm text-muted-foreground">{c.description}</p>
            </div>
            <ChargeStatusBadge status={c.status} daysLate={c.daysLate} />
          </div>

          {step === 'details' ? (
            <>
              <div className="rounded-3xl bg-muted/70 p-5 text-center">
                <p className="text-sm font-semibold text-muted-foreground">
                  {c.status === ChargeStatus.PAGO ? 'Pago' : c.paidCents ? 'Falta receber' : 'Valor'}
                </p>
                <p className="font-display text-4xl font-black tabular">
                  {formatBRL(c.status === ChargeStatus.PAGO || c.status === ChargeStatus.CANCELADO ? c.netCents : c.balanceCents)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {dueLabel(c.dueDate, today)}
                  {c.discountCents ? ` · desconto ${formatBRL(c.discountCents)}` : ''}
                  {c.paidCents && c.status !== ChargeStatus.PAGO ? ` · já pago ${formatBRL(c.paidCents)}` : ''}
                </p>
                {c.kind === ChargeKind.PACOTE && c.packageLessons ? (
                  <div className="mx-auto mt-3 max-w-56">
                    <div className="h-2 overflow-hidden rounded-full bg-card">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((c.packageUsed ?? 0) / c.packageLessons) * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {c.packageUsed}/{c.packageLessons} aulas usadas
                    </p>
                  </div>
                ) : c.lessonsCount ? (
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{c.lessonsCount} aula(s) no fechamento</p>
                ) : null}
              </div>

              {isOpen ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <Button size="lg" className="col-span-2 bg-success text-white shadow-none hover:bg-success hover:brightness-95" onClick={() => setStep('pay')}>
                    <HandCoins /> Recebi
                  </Button>
                  <WhatsappChargeButton chargeId={c.id} variant="soft" label="WhatsApp" className="bg-success-soft text-success-soft-foreground" />
                  <Button variant="soft" onClick={() => setStep('edit')}>
                    <Pencil /> Editar
                  </Button>
                </div>
              ) : null}
              {isOpen ? (
                <div className="-mt-2 text-center">
                  <CopyMessageButton chargeId={c.id} />
                </div>
              ) : null}

              {c.payments.length ? (
                <section>
                  <h3 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">Pagamentos</h3>
                  <ul className="space-y-2">
                    {c.payments.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold tabular">{formatBRL(p.amountCents)}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDateShort(p.paidAt)} · {PAYMENT_METHOD_LABEL[p.method]}
                            {p.note ? ` · ${p.note}` : ''}
                          </p>
                        </div>
                        <Link
                          href={`/recibo/${p.id}`}
                          onClick={onClose}
                          aria-label="Ver recibo"
                          className="grid size-10 place-items-center rounded-xl text-primary hover:bg-muted"
                        >
                          <ReceiptText className="size-5" />
                        </Link>
                        <button
                          type="button"
                          aria-label="Estornar pagamento"
                          onClick={() =>
                            removePayment.mutate(p.id, {
                              onSuccess: () => toast('Pagamento estornado'),
                              onError: (err) => toast.error(errMsg(err, 'Não foi possível estornar')),
                            })
                          }
                          className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
                        >
                          <Undo2 className="size-5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className="flex flex-wrap justify-center gap-2">
                {c.status === ChargeStatus.CANCELADO ? (
                  <Button variant="ghost" size="sm" onClick={() => reopen.mutate(c.id, { onSuccess: () => toast('Cobrança reaberta') })}>
                    <RotateCcw className="!size-4" /> Reabrir
                  </Button>
                ) : !c.payments.length ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() =>
                      cancel.mutate(c.id, {
                        onSuccess: () => toast('Cobrança cancelada'),
                        onError: (err) => toast.error(errMsg(err, 'Não foi possível cancelar')),
                      })
                    }
                  >
                    <Ban className="!size-4" /> Cancelar cobrança
                  </Button>
                ) : null}
                {(c.kind === ChargeKind.AVULSA || c.kind === ChargeKind.AJUSTE) && !c.payments.length ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    onClick={() =>
                      remove.mutate(c.id, {
                        onSuccess: () => {
                          toast('Cobrança apagada');
                          onClose();
                        },
                      })
                    }
                  >
                    <Trash2 className="!size-4" /> Apagar
                  </Button>
                ) : null}
              </div>
            </>
          ) : step === 'pay' ? (
            <PaymentForm charge={c} today={today} onDone={onClose} />
          ) : (
            <EditForm charge={c} onDone={() => setStep('details')} />
          )}
          {step !== 'details' ? (
            <Button variant="ghost" block onClick={() => setStep('details')}>
              Voltar
            </Button>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
