'use client';

import { describePlan, displayName, normalizePlanInput, todayIn, DEFAULT_TIMEZONE } from '@turmei/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { FormProvider, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { toast } from 'sonner';
import { FormTopBar, StickyActions, useBack } from '@/components/layout/form-page';
import { PlanFields } from '@/components/students/plan-fields';
import { StudentAvatar } from '@/components/students/student-avatar';
import {
  AppearanceFields,
  GuardianFields,
  IdentityFields,
  NotesField,
  StartDateField,
  TagsField,
} from '@/components/students/student-fields';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import { useCreateStudent } from '@/lib/queries/students';
import {
  emptyPlan,
  newStudentSchema,
  studentDefaults,
  toPlanInput,
  toStudentFields,
  type NewStudentFormValues,
} from '@/lib/students/form';
import { useTagSuggestions } from '@/lib/students/use-tag-suggestions';
import { cn, haptic } from '@/lib/utils';

const STEPS: { title: string; subtitle: string; fields: FieldPath<NewStudentFormValues>[] }[] = [
  {
    title: 'Quem é o aluno?',
    subtitle: 'Só o nome é obrigatório.',
    fields: ['name', 'nickname', 'phone', 'email', 'birthDate', 'color', 'emoji'],
  },
  {
    title: 'Responsável e detalhes',
    subtitle: 'Tudo opcional — dá para completar depois.',
    fields: ['hasGuardian', 'guardianName', 'guardianPhone', 'payerIsGuardian', 'tags', 'notes'],
  },
  {
    title: 'Como vai pagar?',
    subtitle: 'Mudou o valor depois? É só reajustar na ficha.',
    fields: ['plan', 'startDate'],
  },
];

function Preview() {
  const values = useWatch<NewStudentFormValues>();
  const typed = values.name?.trim();
  const name = typed || 'Novo aluno';
  const plan = values.plan && normalizePlanInput(toPlanInput(values.plan as NewStudentFormValues['plan']));
  return (
    <div className="flex items-center gap-4 rounded-3xl bg-card p-4 shadow-soft">
      <StudentAvatar
        name={name}
        color={values.color ?? 'lavanda'}
        emoji={values.emoji ?? (typed ? null : '🌱')}
        size="lg"
        className="transition-all"
      />
      <div className="min-w-0">
        <p className="truncate font-display text-xl font-black">
          {displayName({ name, nickname: values.nickname ?? null })}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {plan && !plan.errors.length ? describePlan(plan.plan) : values.nickname ? name : 'Preenchendo a ficha…'}
        </p>
      </div>
    </div>
  );
}

export default function NovoAlunoPage() {
  const router = useRouter();
  const back = useBack('/alunos');
  const { teacher } = useAuth();
  const tagSuggestions = useTagSuggestions();
  const create = useCreateStudent();
  const [step, setStep] = React.useState(0);

  const form = useForm<NewStudentFormValues>({
    resolver: zodResolver(newStudentSchema),
    defaultValues: {
      ...studentDefaults(todayIn(teacher?.timezone ?? DEFAULT_TIMEZONE)),
      plan: emptyPlan(),
    },
    mode: 'onTouched',
  });

  const goTo = (next: number) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const next = async () => {
    const ok = await form.trigger(STEPS[step].fields, { shouldFocus: true });
    if (!ok) {
      haptic([30, 40, 30]);
      return;
    }
    haptic(10);
    goTo(step + 1);
  };

  const onSubmit = form.handleSubmit(
    async (values) => {
      try {
        const student = await create.mutateAsync({
          ...toStudentFields(values),
          plan: toPlanInput(values.plan),
        });
        haptic([15, 60, 25]);
        toast.success(`${displayName(student)} chegou! 🌷`);
        router.replace(`/alunos/${student.id}`);
      } catch (err) {
        toast.error(err instanceof ApiError ? (err.details?.[0] ?? err.message) : 'Não foi possível salvar');
      }
    },
    (errors) => {
      // Erro numa etapa anterior (raro): volta para ela.
      const first = STEPS.findIndex((s) => s.fields.some((f) => f.split('.')[0] in errors));
      if (first > -1 && first !== step) goTo(first);
      haptic([30, 40, 30]);
    },
  );

  const isLast = step === STEPS.length - 1;

  return (
    <FormProvider {...form}>
      <FormTopBar onBack={step ? () => goTo(step - 1) : back} variant={step ? 'back' : 'close'}>
        <div className="flex flex-1 items-center gap-1.5 pr-3" aria-label={`Passo ${step + 1} de ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-300',
                i <= step ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
      </FormTopBar>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (isLast) onSubmit(e);
          else next();
        }}
        className="flex min-h-[calc(100dvh-4rem)] flex-col"
      >
        <div className="flex-1 space-y-6 px-5 pt-2">
          <div key={step} className="animate-fade-up">
            <p className="text-sm font-semibold text-primary-soft-foreground">
              Passo {step + 1} de {STEPS.length}
            </p>
            <h1 className="text-3xl font-black">{STEPS[step].title}</h1>
            <p className="mt-1 text-muted-foreground">{STEPS[step].subtitle}</p>
          </div>

          <Preview />

          <div key={`f${step}`} className="animate-fade-up space-y-6">
            {step === 0 ? (
              <>
                <IdentityFields />
                <AppearanceFields />
              </>
            ) : step === 1 ? (
              <>
                <GuardianFields />
                <TagsField suggestions={tagSuggestions} />
                <NotesField />
              </>
            ) : (
              <>
                <PlanFields />
                <StartDateField />
              </>
            )}
          </div>
        </div>

        <StickyActions>
          {isLast ? (
            <Button type="submit" size="lg" block loading={create.isPending}>
              <Check /> Cadastrar aluno
            </Button>
          ) : (
            <Button type="submit" size="lg" block>
              Continuar <ArrowRight />
            </Button>
          )}
        </StickyActions>
      </form>
    </FormProvider>
  );
}
