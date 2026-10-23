'use client';

import { PAYMENT_METHOD_LABEL, PaymentMethod, type ChargeDto } from '@aulinha/contracts';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { ApiError } from '@/lib/api/client';
import { celebrate } from '@/lib/celebrate';
import { financeApi } from '@/lib/api/finance';
import { usePay } from '@/lib/queries/finance';
import { haptic } from '@/lib/utils';

const METHODS = [PaymentMethod.PIX, PaymentMethod.DINHEIRO, PaymentMethod.CARTAO, PaymentMethod.TRANSFERENCIA, PaymentMethod.OUTRO];
const LAST_METHOD = 'aulinha_last_method';

function lastMethod(): PaymentMethod {
  try {
    const m = localStorage.getItem(LAST_METHOD);
    return METHODS.includes(m as PaymentMethod) ? (m as PaymentMethod) : PaymentMethod.PIX;
  } catch {
    return PaymentMethod.PIX;
  }
}

/** Valor e data já preenchidos: na maioria das vezes é só tocar em "Confirmar". */
export function PaymentForm({ charge, today, onDone }: { charge: ChargeDto; today: string; onDone: () => void }) {
  const pay = usePay();
  const [amount, setAmount] = React.useState<number | null>(charge.balanceCents);
  const [date, setDate] = React.useState(today);
  const [method, setMethod] = React.useState<PaymentMethod>(lastMethod);
  const [note, setNote] = React.useState('');

  const submit = () => {
    if (!amount) {
      toast.error('Informe o valor recebido');
      return;
    }
    try {
      localStorage.setItem(LAST_METHOD, method);
    } catch {
      /* ignora */
    }
    pay.mutate(
      { id: charge.id, body: { amountCents: amount, paidAt: date, method, note: note.trim() || null } },
      {
        onSuccess: async (c) => {
          haptic([15, 60, 25]);
          toast.success(c.status === 'PAGO' ? 'Pagamento recebido 💸' : 'Pagamento parcial registrado');
          onDone();
          // Celebra quando o mês inteiro fica quitado.
          if (c.status === 'PAGO' && c.dueDate.slice(0, 7) === today.slice(0, 7)) {
            const s = await financeApi.summary(today.slice(0, 7)).catch(() => null);
            if (s && s.chargesCount > 0 && s.paidCount === s.chargesCount) {
              celebrate();
              toast.success('Todos os pagamentos do mês recebidos! 🎉');
            }
          }
        },
        onError: (err) => toast.error(err instanceof ApiError ? (err.details?.[0] ?? err.message) : 'Não foi possível registrar'),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Field label="Valor recebido" htmlFor="pay-amount" hint={amount && amount < charge.balanceCents ? 'Pagamento parcial — o resto fica em aberto.' : undefined}>
        <MoneyInput id="pay-amount" value={amount} onChange={setAmount} />
      </Field>
      <div className="space-y-2">
        <p className="pl-1 text-sm font-semibold">Forma</p>
        <div className="flex flex-wrap gap-1.5">
          {METHODS.map((m) => (
            <Chip key={m} active={method === m} onClick={() => setMethod(m)}>
              {PAYMENT_METHOD_LABEL[m]}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data" htmlFor="pay-date">
          <Input id="pay-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Obs." htmlFor="pay-note">
          <Input id="pay-note" placeholder="opcional" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <Button block size="lg" loading={pay.isPending} onClick={submit} className="bg-success text-white shadow-none hover:bg-success hover:brightness-95">
        Confirmar recebimento
      </Button>
    </div>
  );
}
