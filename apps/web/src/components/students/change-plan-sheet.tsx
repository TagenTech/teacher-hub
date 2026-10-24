'use client';

import { describePlan, formatDateLong, type StudentDetailDto } from '@turmei/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays } from 'lucide-react';
import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { ApiError } from '@/lib/api/client';
import { useAddPlan } from '@/lib/queries/students';
import {
  changePlanSchema,
  emptyPlan,
  firstDayOfNextMonth,
  toPlanInput,
  type ChangePlanFormValues,
} from '@/lib/students/form';
import { haptic } from '@/lib/utils';
import { PlanFields } from './plan-fields';

export function ChangePlanSheet({
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
  const addPlan = useAddPlan(student.id);
  const latest = student.plans[0] ?? null;
  const defaults = React.useCallback(
    (): ChangePlanFormValues => ({ plan: emptyPlan(latest), validFrom: firstDayOfNextMonth(today) }),
    [latest, today],
  );
  const form = useForm<ChangePlanFormValues>({ resolver: zodResolver(changePlanSchema), defaultValues: defaults() });

  React.useEffect(() => {
    if (open) form.reset(defaults());
  }, [open, form, defaults]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (latest && values.validFrom <= latest.validFrom) {
      form.setError('validFrom', {
        message: `Precisa ser depois de ${formatDateLong(latest.validFrom)}, início do plano atual`,
      });
      return;
    }
    try {
      const saved = await addPlan.mutateAsync({ ...toPlanInput(values.plan), validFrom: values.validFrom });
      haptic(15);
      toast.success(
        saved.upcomingPlan
          ? `Reajuste agendado para ${formatDateLong(values.validFrom, false)} 📌`
          : 'Plano atualizado ✨',
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? (err.details?.[0] ?? err.message) : 'Não foi possível salvar');
    }
  });

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Reajustar ou mudar plano"
      description={latest ? `Hoje: ${describePlan(latest)}` : undefined}
    >
      <FormProvider {...form}>
        <form noValidate onSubmit={onSubmit} className="space-y-5">
          <PlanFields />
          <Field
            label="Vale a partir de"
            htmlFor="validFrom"
            error={form.formState.errors.validFrom?.message}
            hint="As cobranças antes dessa data continuam com o valor antigo."
          >
            <Input
              id="validFrom"
              type="date"
              icon={<CalendarDays />}
              invalid={!!form.formState.errors.validFrom}
              {...form.register('validFrom')}
            />
          </Field>
          <Field label="Motivo (opcional)" htmlFor="plan-note">
            <Input id="plan-note" placeholder="Reajuste anual, mudou para 2x na semana…" {...form.register('plan.note')} />
          </Field>
          <Button type="submit" size="lg" block loading={addPlan.isPending}>
            Salvar novo plano
          </Button>
        </form>
      </FormProvider>
    </Sheet>
  );
}
