'use client';

import { displayName, type StudentDetailDto } from '@turmei/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormTopBar, StickyActions, useBack } from '@/components/layout/form-page';
import {
  AppearanceFields,
  GuardianFields,
  IdentityFields,
  NotesField,
  StartDateField,
  TagsField,
} from '@/components/students/student-fields';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { useStudent, useUpdateStudent } from '@/lib/queries/students';
import { studentDefaults, studentSchema, toStudentFields, type StudentFormValues } from '@/lib/students/form';
import { useTagSuggestions } from '@/lib/students/use-tag-suggestions';
import { haptic } from '@/lib/utils';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <Card className="space-y-4">{children}</Card>
    </section>
  );
}

function EditForm({ student }: { student: StudentDetailDto }) {
  const router = useRouter();
  const back = useBack(`/alunos/${student.id}`);
  const update = useUpdateStudent(student.id);
  const tagSuggestions = useTagSuggestions();
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: studentDefaults(student.startDate, student),
  });

  const onSubmit = form.handleSubmit(
    async (values) => {
      try {
        const saved = await update.mutateAsync(toStudentFields(values));
        haptic(15);
        toast.success('Ficha atualizada ✨');
        router.replace(`/alunos/${saved.id}`);
      } catch (err) {
        toast.error(err instanceof ApiError ? (err.details?.[0] ?? err.message) : 'Não foi possível salvar');
      }
    },
    () => haptic([30, 40, 30]),
  );

  return (
    <FormProvider {...form}>
      <FormTopBar onBack={back} variant="close" title={`Editar ${displayName(student)}`} />
      <form noValidate onSubmit={onSubmit}>
        <div className="space-y-6 px-5 pt-2">
          <Section title="Dados">
            <IdentityFields />
          </Section>
          <Section title="Aparência">
            <AppearanceFields />
          </Section>
          <Section title="Responsável">
            <GuardianFields />
          </Section>
          <Section title="Detalhes">
            <TagsField suggestions={tagSuggestions} />
            <NotesField />
            <StartDateField />
          </Section>
        </div>
        <StickyActions>
          <Button type="button" variant="outline" size="lg" onClick={back}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" block loading={update.isPending} disabled={!form.formState.isDirty}>
            <Check /> Salvar
          </Button>
        </StickyActions>
      </form>
    </FormProvider>
  );
}

export default function EditarAlunoPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending, isError } = useStudent(id);
  const back = useBack('/alunos');

  if (isPending) {
    return (
      <div className="space-y-4 p-5">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-72" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <>
        <FormTopBar onBack={back} />
        <EmptyState emoji="🫥" tone="sky" title="Aluno não encontrado" description="Ele pode ter sido excluído." />
      </>
    );
  }
  return <EditForm student={data} />;
}
