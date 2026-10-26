import {
  BillingPlanType,
  isIsoDate,
  isValidPhone,
  normalizePlanInput,
  STUDENT_COLORS,
  STUDENT_LIMITS,
  type BillingPlanDto,
  type BillingPlanInput,
  type IsoDate,
  type StudentDetailDto,
  type StudentFields,
} from '@turmei/contracts';
import { z } from 'zod';

const optionalPhone = (message: string) =>
  z.string().refine((v) => !v || isValidPhone(v), message);

export const studentShape = {
  name: z.string().trim().min(1, 'Informe o nome do aluno').max(STUDENT_LIMITS.name),
  nickname: z.string().trim().max(STUDENT_LIMITS.nickname),
  phone: optionalPhone('Telefone inválido — use DDD + número, ou + e o código do país'),
  email: z
    .string()
    .trim()
    .max(STUDENT_LIMITS.email)
    .refine((v) => !v || z.string().email().safeParse(v).success, 'Esse e-mail não parece certo'),
  birthDate: z.string().refine((v) => !v || isIsoDate(v), 'Data inválida'),
  hasGuardian: z.boolean(),
  guardianName: z.string().trim().max(STUDENT_LIMITS.name),
  guardianPhone: optionalPhone('Telefone do responsável inválido — use DDD + número, ou + e o código do país'),
  payerIsGuardian: z.boolean(),
  color: z.enum(STUDENT_COLORS),
  emoji: z.string().nullable(),
  startDate: z.string().refine(isIsoDate, 'Escolha a data de início'),
  tags: z.array(z.string()).max(STUDENT_LIMITS.tags, `Use no máximo ${STUDENT_LIMITS.tags} etiquetas`),
  notes: z.string().max(STUDENT_LIMITS.notes, 'Texto muito longo'),
};

type GuardianValues = { hasGuardian: boolean; guardianName: string };
const requireGuardianName = (v: GuardianValues, ctx: z.RefinementCtx) => {
  if (v.hasGuardian && !v.guardianName.trim()) {
    ctx.addIssue({ code: 'custom', path: ['guardianName'], message: 'Informe o nome do responsável' });
  }
};

export const planSchema = z
  .object({
    type: z.nativeEnum(BillingPlanType),
    monthlyFeeCents: z.number().nullable(),
    lessonPriceCents: z.number().nullable(),
    packageLessons: z.number().nullable(),
    packagePriceCents: z.number().nullable(),
    dueDay: z.number().nullable(),
    note: z.string().max(200),
  })
  .superRefine((v, ctx) => {
    for (const e of normalizePlanInput(v).errors) {
      ctx.addIssue({ code: 'custom', path: [e.field], message: e.message });
    }
  });

export const studentSchema = z.object(studentShape).superRefine(requireGuardianName);
export const newStudentSchema = z.object({ ...studentShape, plan: planSchema }).superRefine(requireGuardianName);
export const changePlanSchema = z.object({
  plan: planSchema,
  validFrom: z.string().refine(isIsoDate, 'Escolha a data'),
});

export type StudentFormValues = z.infer<typeof studentSchema>;
export type PlanFormValues = z.infer<typeof planSchema>;
export type NewStudentFormValues = z.infer<typeof newStudentSchema>;
export type ChangePlanFormValues = z.infer<typeof changePlanSchema>;

export function emptyPlan(from?: BillingPlanDto | null): PlanFormValues {
  return {
    type: from?.type ?? BillingPlanType.MENSAL,
    monthlyFeeCents: from?.monthlyFeeCents ?? null,
    lessonPriceCents: from?.lessonPriceCents ?? null,
    packageLessons: from?.packageLessons ?? null,
    packagePriceCents: from?.packagePriceCents ?? null,
    dueDay: from?.dueDay ?? 10,
    note: '',
  };
}

export function studentDefaults(today: IsoDate, s?: StudentDetailDto): StudentFormValues {
  return {
    name: s?.name ?? '',
    nickname: s?.nickname ?? '',
    phone: s?.phone ?? '',
    email: s?.email ?? '',
    birthDate: s?.birthDate ?? '',
    hasGuardian: !!s?.guardianName,
    guardianName: s?.guardianName ?? '',
    guardianPhone: s?.guardianPhone ?? '',
    payerIsGuardian: s?.payerIsGuardian ?? false,
    color: s?.color ?? STUDENT_COLORS[Math.floor(Math.random() * STUDENT_COLORS.length)],
    emoji: s?.emoji ?? null,
    startDate: s?.startDate ?? today,
    tags: s?.tags ?? [],
    notes: s?.notes ?? '',
  };
}

/** Formulário → API: vazios viram null; sem responsável, zera os campos dele. */
export function toStudentFields(v: StudentFormValues): StudentFields {
  const orNull = (x: string) => x.trim() || null;
  return {
    name: v.name.trim(),
    nickname: orNull(v.nickname),
    phone: orNull(v.phone),
    email: orNull(v.email),
    birthDate: orNull(v.birthDate),
    guardianName: v.hasGuardian ? orNull(v.guardianName) : null,
    guardianPhone: v.hasGuardian ? orNull(v.guardianPhone) : null,
    payerIsGuardian: v.hasGuardian && v.payerIsGuardian,
    color: v.color,
    emoji: v.emoji,
    startDate: v.startDate,
    tags: v.tags,
    notes: orNull(v.notes),
  };
}

export function toPlanInput(p: PlanFormValues): BillingPlanInput {
  return { ...p, note: p.note.trim() || null };
}

/** Primeiro dia do mês seguinte — data padrão de um reajuste. */
export function firstDayOfNextMonth(today: IsoDate): IsoDate {
  const [y, m] = today.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
