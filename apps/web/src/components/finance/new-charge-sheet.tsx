'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { StudentPicker } from '@/components/agenda/student-picker';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Sheet } from '@/components/ui/sheet';
import { ApiError } from '@/lib/api/client';
import { useCreateCharge } from '@/lib/queries/finance';
import { useToday } from '@/lib/use-today';
import { haptic } from '@/lib/utils';

const SUGGESTIONS = ['Material didático', 'Aula extra', 'Apostila', 'Taxa de matrícula', 'Recital'];

export function NewChargeSheet({ prefill, onClose }: { prefill: { studentId?: string } | null; onClose: () => void }) {
  const today = useToday();
  const create = useCreateCharge();
  const [studentId, setStudentId] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState('');
  const [amount, setAmount] = React.useState<number | null>(null);
  const [due, setDue] = React.useState('');
  const [openedWith, setOpenedWith] = React.useState<object | null>(null);
  if (prefill && prefill !== openedWith) {
    setOpenedWith(prefill);
    setStudentId(prefill.studentId ?? null);
    setDescription('');
    setAmount(null);
    setDue(today ?? '');
  }

  return (
    <Sheet open={!!prefill} onOpenChange={(o) => !o && onClose()} title="Nova cobrança" description="Para algo fora da mensalidade.">
      <div className="space-y-4">
        {!prefill?.studentId ? (
          <div className="space-y-2">
            <p className="pl-1 text-sm font-semibold">Aluno</p>
            <StudentPicker value={studentId} onChange={setStudentId} />
          </div>
        ) : null}
        <Field label="Descrição" htmlFor="nc-desc">
          <Input id="nc-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Material didático" />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <Chip key={s} active={description === s} onClick={() => setDescription(s)}>
              {s}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor" htmlFor="nc-amount">
            <MoneyInput id="nc-amount" value={amount} onChange={setAmount} />
          </Field>
          <Field label="Vencimento" htmlFor="nc-due">
            <Input id="nc-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        <Button
          block
          size="lg"
          loading={create.isPending}
          onClick={() => {
            if (!studentId || !description.trim() || !amount || !due) {
              toast.error('Preencha aluno, descrição, valor e vencimento');
              return;
            }
            create.mutate(
              { studentId, description: description.trim(), amountCents: amount, dueDate: due },
              {
                onSuccess: () => {
                  haptic(15);
                  toast.success('Cobrança criada 💰');
                  onClose();
                },
                onError: (err) => toast.error(err instanceof ApiError ? (err.details?.[0] ?? err.message) : 'Não foi possível criar'),
              },
            );
          }}
        >
          Criar cobrança
        </Button>
      </div>
    </Sheet>
  );
}
