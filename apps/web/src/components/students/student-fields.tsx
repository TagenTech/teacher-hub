'use client';

import { normalizeTag, STUDENT_COLORS, STUDENT_EMOJIS, STUDENT_LIMITS } from '@aulinha/contracts';
import { AtSign, Cake, Phone, User, X } from 'lucide-react';
import * as React from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { SwitchRow } from '@/components/ui/switch-row';
import { Textarea } from '@/components/ui/textarea';
import type { StudentFormValues } from '@/lib/students/form';
import { cn, haptic } from '@/lib/utils';
import { studentColorStyle } from './student-avatar';

const COLOR_LABEL: Record<(typeof STUDENT_COLORS)[number], string> = {
  lavanda: 'Lavanda',
  rosa: 'Rosa',
  menta: 'Menta',
  pessego: 'Pêssego',
  ceu: 'Céu',
  lilas: 'Lilás',
  limao: 'Limão',
  coral: 'Coral',
};

export function IdentityFields() {
  const { register, control, formState } = useFormContext<StudentFormValues>();
  const { errors } = formState;
  return (
    <div className="space-y-4">
      <Field label="Nome completo" htmlFor="name" error={errors.name?.message}>
        <Input
          id="name"
          autoComplete="off"
          autoCapitalize="words"
          placeholder="Ana Clara Souza"
          icon={<User />}
          invalid={!!errors.name}
          {...register('name')}
        />
      </Field>
      <Field label="Como você chama" htmlFor="nickname" hint="Opcional — aparece na agenda" error={errors.nickname?.message}>
        <Input id="nickname" autoComplete="off" placeholder="Aninha" {...register('nickname')} />
      </Field>
      <Field label="WhatsApp" htmlFor="phone" error={errors.phone?.message}>
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <PhoneInput
              id="phone"
              icon={<Phone />}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              invalid={!!errors.phone}
            />
          )}
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            placeholder="opcional"
            icon={<AtSign />}
            invalid={!!errors.email}
            {...register('email')}
          />
        </Field>
        <Field label="Aniversário" htmlFor="birthDate" error={errors.birthDate?.message}>
          <Input id="birthDate" type="date" icon={<Cake />} invalid={!!errors.birthDate} {...register('birthDate')} />
        </Field>
      </div>
    </div>
  );
}

export function AppearanceFields() {
  const { control } = useFormContext<StudentFormValues>();
  const color = useWatch({ control, name: 'color' });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="pl-1 text-sm font-semibold" id="color-label">
          Cor na agenda
        </p>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <div role="radiogroup" aria-labelledby="color-label" className="flex flex-wrap gap-2.5">
              {STUDENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={field.value === c}
                  aria-label={COLOR_LABEL[c]}
                  onClick={() => {
                    haptic(6);
                    field.onChange(c);
                  }}
                  className={cn(
                    'grid size-11 place-items-center rounded-full transition-all active:scale-90',
                    field.value === c ? 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card' : '',
                  )}
                  style={{ background: `var(--stu-${c})` }}
                >
                  <span className="size-3.5 rounded-full" style={{ background: `var(--stu-${c}-fg)` }} />
                </button>
              ))}
            </div>
          )}
        />
      </div>

      <div className="space-y-2">
        <p className="pl-1 text-sm font-semibold" id="emoji-label">
          Figurinha
        </p>
        <Controller
          control={control}
          name="emoji"
          render={({ field }) => (
            <div role="radiogroup" aria-labelledby="emoji-label" className="grid grid-cols-5 gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={!field.value}
                aria-label="Usar as iniciais"
                onClick={() => field.onChange(null)}
                className={cn(
                  'grid h-12 place-items-center rounded-2xl font-display text-base font-black transition-all active:scale-90',
                  !field.value ? 'ring-2 ring-foreground' : '',
                )}
                style={studentColorStyle(color)}
              >
                Aa
              </button>
              {STUDENT_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  role="radio"
                  aria-checked={field.value === e}
                  aria-label={e}
                  onClick={() => {
                    haptic(6);
                    field.onChange(e);
                  }}
                  className={cn(
                    'grid h-12 place-items-center rounded-2xl text-2xl transition-all active:scale-90',
                    field.value === e ? 'ring-2 ring-foreground' : 'bg-muted',
                  )}
                  style={field.value === e ? studentColorStyle(color) : undefined}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        />
      </div>
    </div>
  );
}

export function GuardianFields() {
  const { register, control, formState, setValue } = useFormContext<StudentFormValues>();
  const hasGuardian = useWatch({ control, name: 'hasGuardian' });
  const payer = useWatch({ control, name: 'payerIsGuardian' });
  const { errors } = formState;

  return (
    <div className="space-y-4">
      <SwitchRow
        id="hasGuardian"
        checked={hasGuardian}
        onCheckedChange={(v) => setValue('hasGuardian', v, { shouldDirty: true })}
        title="Tem um responsável"
        description="Para alunos menores ou quando outra pessoa cuida das aulas."
      />
      {hasGuardian ? (
        <div className="animate-fade-up space-y-4">
          <Field label="Nome do responsável" htmlFor="guardianName" error={errors.guardianName?.message}>
            <Input
              id="guardianName"
              autoCapitalize="words"
              placeholder="Marta Souza"
              icon={<User />}
              invalid={!!errors.guardianName}
              {...register('guardianName')}
            />
          </Field>
          <Field label="WhatsApp do responsável" htmlFor="guardianPhone" error={errors.guardianPhone?.message}>
            <Controller
              control={control}
              name="guardianPhone"
              render={({ field }) => (
                <PhoneInput
                  id="guardianPhone"
                  icon={<Phone />}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={!!errors.guardianPhone}
                />
              )}
            />
          </Field>
          <SwitchRow
            id="payerIsGuardian"
            checked={payer}
            onCheckedChange={(v) => setValue('payerIsGuardian', v, { shouldDirty: true })}
            title="O responsável que paga"
            description="Os lembretes de cobrança vão para o WhatsApp dele."
          />
        </div>
      ) : null}
    </div>
  );
}

export function TagsField({ suggestions = [] }: { suggestions?: string[] }) {
  const { control, formState } = useFormContext<StudentFormValues>();
  const [draft, setDraft] = React.useState('');

  return (
    <Controller
      control={control}
      name="tags"
      render={({ field }) => {
        const tags = field.value;
        const add = (raw: string) => {
          const tag = normalizeTag(raw);
          if (tag && !tags.includes(tag) && tags.length < STUDENT_LIMITS.tags) field.onChange([...tags, tag]);
          setDraft('');
        };
        const remaining = suggestions.filter((s) => !tags.includes(s)).slice(0, 8);
        return (
          <div className="space-y-2">
            <label htmlFor="tag-input" className="block pl-1 text-sm font-semibold">
              Etiquetas
            </label>
            <div className="flex min-h-13 flex-wrap items-center gap-1.5 rounded-2xl border-2 border-input bg-card px-3 py-2 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary-soft">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-1 pl-3 pr-1.5 text-sm font-semibold text-primary-soft-foreground"
                >
                  #{t}
                  <button
                    type="button"
                    aria-label={`Remover ${t}`}
                    onClick={() => field.onChange(tags.filter((x) => x !== t))}
                    className="grid size-5 place-items-center rounded-full hover:bg-white/50"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
              <input
                id="tag-input"
                value={draft}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.endsWith(',')) add(v.slice(0, -1));
                  else setDraft(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add(draft);
                  } else if (e.key === 'Backspace' && !draft && tags.length) {
                    field.onChange(tags.slice(0, -1));
                  }
                }}
                onBlur={() => draft && add(draft)}
                placeholder={tags.length ? '' : 'piano, iniciante, online…'}
                enterKeyHint="done"
                className="h-8 min-w-24 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
              />
            </div>
            {remaining.length ? (
              <div className="flex flex-wrap gap-1.5 pl-1">
                {remaining.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => add(s)}
                    className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                  >
                    + #{s}
                  </button>
                ))}
              </div>
            ) : null}
            {formState.errors.tags ? (
              <p role="alert" className="pl-1 text-sm font-medium text-danger">
                {formState.errors.tags.message}
              </p>
            ) : null}
          </div>
        );
      }}
    />
  );
}

export function NotesField() {
  const { register, formState } = useFormContext<StudentFormValues>();
  return (
    <Field label="Observações" htmlFor="notes" error={formState.errors.notes?.message}>
      <Textarea
        id="notes"
        placeholder="Objetivos, preferências, o que é bom lembrar…"
        maxLength={STUDENT_LIMITS.notes}
        {...register('notes')}
      />
    </Field>
  );
}

export function StartDateField() {
  const { register, formState } = useFormContext<StudentFormValues>();
  return (
    <Field
      label="Aluno desde"
      htmlFor="startDate"
      hint="O plano de cobrança começa a valer nesta data."
      error={formState.errors.startDate?.message}
    >
      <Input id="startDate" type="date" invalid={!!formState.errors.startDate} {...register('startDate')} />
    </Field>
  );
}
