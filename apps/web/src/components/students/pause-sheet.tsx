'use client';

import { addDays, displayName, formatDateLong, StudentStatus, type StudentDetailDto } from '@turmei/contracts';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { ApiError } from '@/lib/api/client';
import { useChangeStudentStatus } from '@/lib/queries/students';
import { haptic } from '@/lib/utils';

const QUICK = [
  { label: '1 semana', days: 7 },
  { label: '15 dias', days: 15 },
  { label: '1 mês', days: 30 },
];

export function PauseSheet({
  student,
  today,
  open,
  onOpenChange,
}: {
  student: StudentDetailDto;
  today: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const change = useChangeStudentStatus(student.id);
  const [until, setUntil] = React.useState('');

  const save = async () => {
    try {
      await change.mutateAsync({ status: StudentStatus.PAUSADO, pausedUntil: until || null });
      haptic(15);
      toast.success(
        until ? `${displayName(student)} volta em ${formatDateLong(until, false)} ⏸` : `${displayName(student)} pausado ⏸`,
      );
      onOpenChange(false);
      setUntil('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível pausar');
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Pausar ${displayName(student)}`}
      description="Férias, viagem, um tempinho… Não gera aulas nem cobranças enquanto estiver pausado."
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => {
            const date = addDays(today, q.days);
            return (
              <Chip key={q.label} active={until === date} onClick={() => setUntil(date)}>
                {q.label}
              </Chip>
            );
          })}
          <Chip active={!until} onClick={() => setUntil('')}>
            Sem data
          </Chip>
        </div>
        <Field
          label="Volta em"
          htmlFor="pausedUntil"
          hint={until ? 'Volta a ficar ativo sozinho depois dessa data.' : 'Você reativa quando quiser.'}
        >
          <Input id="pausedUntil" type="date" min={today} value={until} onChange={(e) => setUntil(e.target.value)} />
        </Field>
        <Button size="lg" block loading={change.isPending} onClick={save}>
          Pausar aluno
        </Button>
      </div>
    </Sheet>
  );
}
