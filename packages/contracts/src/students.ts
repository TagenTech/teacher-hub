import type { IsoDate } from './dates';
import type { StudentStatus } from './enums';
import type { BillingPlanDto, BillingPlanInput } from './plans';

/** Cores pastel da agenda/avatar. As cores reais ficam nos tokens do web. */
export const STUDENT_COLORS = [
  'lavanda',
  'rosa',
  'menta',
  'pessego',
  'ceu',
  'lilas',
  'limao',
  'coral',
] as const;
export type StudentColor = (typeof STUDENT_COLORS)[number];

export const STUDENT_EMOJIS = [
  '🎹', '🎸', '🎻', '🥁', '🎤', '🎺', '📚', '✏️',
  '🧮', '🔬', '🌎', '🗣️', '⚽', '🩰', '🎨', '💻',
  '🌷', '🌻', '🦋', '🐱', '🐶', '🦊', '⭐', '🍓',
] as const;

export const STUDENT_LIMITS = {
  name: 120,
  nickname: 40,
  email: 180,
  notes: 2000,
  tag: 24,
  tags: 8,
} as const;

export interface StudentFields {
  name: string;
  nickname?: string | null;
  phone?: string | null;
  email?: string | null;
  birthDate?: IsoDate | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  payerIsGuardian?: boolean;
  color?: StudentColor;
  emoji?: string | null;
  startDate?: IsoDate;
  tags?: string[];
  notes?: string | null;
}

export interface CreateStudentRequest extends StudentFields {
  plan: BillingPlanInput;
}

export type UpdateStudentRequest = Partial<StudentFields>;

export interface ChangeStudentStatusRequest {
  status: StudentStatus;
  /** Só para PAUSADO: volta a ATIVO automaticamente depois desta data. */
  pausedUntil?: IsoDate | null;
}

export interface StudentDto {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  birthDate: IsoDate | null;
  guardianName: string | null;
  guardianPhone: string | null;
  payerIsGuardian: boolean;
  color: StudentColor;
  emoji: string | null;
  status: StudentStatus;
  pausedUntil: IsoDate | null;
  startDate: IsoDate;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentListItemDto extends StudentDto {
  currentPlan: BillingPlanDto | null;
}

export interface StudentDetailDto extends StudentDto {
  currentPlan: BillingPlanDto | null;
  upcomingPlan: BillingPlanDto | null;
  /** Todos os planos, do mais recente para o mais antigo. */
  plans: BillingPlanDto[];
}

/** Normaliza tag: sem espaços extras, minúscula, sem '#'. */
export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/, '').replace(/\s+/g, ' ').toLowerCase().slice(0, STUDENT_LIMITS.tag);
}

/** Texto para busca sem acento e sem caixa: 'Ána Clára' → 'ana clara'. */
export function searchable(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function displayName(s: Pick<StudentDto, 'name' | 'nickname'>): string {
  return s.nickname?.trim() || s.name;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
