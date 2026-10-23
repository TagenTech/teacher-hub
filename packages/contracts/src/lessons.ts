import type { IsoDate } from './dates';
import { LessonStatus, type LessonMode, type MakeupCreditStatus, type StudentStatus } from './enums';
import type { StudentColor } from './students';
import type { HHmm } from './time';

export interface StudentRefDto {
  id: string;
  name: string;
  nickname: string | null;
  color: StudentColor;
  emoji: string | null;
  status: StudentStatus;
}

export interface SlotDto {
  id: string;
  studentId: string;
  weekday: number;
  startTime: HHmm;
  durationMin: number;
  mode: LessonMode;
  location: string | null;
  meetingUrl: string | null;
  validFrom: IsoDate;
  validTo: IsoDate | null;
}

export interface SlotInput {
  weekday: number;
  startTime: HHmm;
  durationMin: number;
  mode: LessonMode;
  location?: string | null;
  meetingUrl?: string | null;
}

export interface CreateSlotRequest extends SlotInput {
  /** A partir de quando vale (padrão: hoje). */
  validFrom?: IsoDate;
}

export interface UpdateSlotRequest extends SlotInput {
  /** Mudança vale desta data em diante ("esta e as próximas"). */
  effectiveFrom: IsoDate;
}

export interface LessonDto {
  id: string;
  student: StudentRefDto;
  slotId: string | null;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  status: LessonStatus;
  mode: LessonMode;
  location: string | null;
  meetingUrl: string | null;
  justified: boolean;
  absenceReason: string | null;
  chargeable: boolean;
  priceCents: number | null;
  content: string | null;
  homework: string | null;
  makeupCreditId: string | null;
  rescheduledFromId: string | null;
  chargeId: string | null;
  markedAt: string | null;
}

export interface CreateLessonRequest {
  studentId: string;
  startsAt: string;
  durationMin: number;
  mode: LessonMode;
  location?: string | null;
  meetingUrl?: string | null;
  /** Agenda uma reposição usando este crédito. */
  makeupCreditId?: string | null;
}

export interface UpdateLessonRequest {
  durationMin?: number;
  mode?: LessonMode;
  location?: string | null;
  meetingUrl?: string | null;
  content?: string | null;
  homework?: string | null;
}

export interface AttendanceRequest {
  status: LessonStatus;
  justified?: boolean;
  reason?: string | null;
  /** Sobrescreve a regra padrão de cobrança. */
  chargeable?: boolean;
  /** Sobrescreve a regra padrão de reposição. */
  createMakeup?: boolean;
}

export interface RescheduleRequest {
  startsAt: string;
  durationMin?: number;
}

export interface MakeupCreditDto {
  id: string;
  student: StudentRefDto;
  originLessonId: string | null;
  originStartsAt: string | null;
  reason: string | null;
  status: MakeupCreditStatus;
  usedLessonId: string | null;
  createdAt: string;
}

export interface ScheduleBlockDto {
  id: string;
  startDate: IsoDate;
  endDate: IsoDate;
  reason: string;
  createdAt: string;
}

export interface CreateScheduleBlockRequest {
  startDate: IsoDate;
  endDate: IsoDate;
  reason: string;
  /** Gera crédito de reposição para as aulas canceladas. */
  createMakeups?: boolean;
}

export const LESSON_STATUS_LABEL: Record<LessonStatus, string> = {
  AGENDADA: 'Agendada',
  REALIZADA: 'Realizada',
  FALTA_ALUNO: 'Falta do aluno',
  FALTA_PROFESSOR: 'Falta do professor',
  CANCELADA: 'Cancelada',
  REMARCADA: 'Remarcada',
};

/** Quanto tempo gerar à frente a partir dos horários fixos. */
export const LESSON_HORIZON_DAYS = 56;

/**
 * Regra padrão de cobrança e reposição por situação (o professor pode mudar caso a caso).
 * | Realizada → cobra | Falta do aluno sem justificativa → cobra |
 * | Falta justificada → não cobra, gera reposição | Falta do professor → não cobra, gera reposição |
 * | Cancelada → não cobra |
 */
export function attendanceDefaults(status: LessonStatus, justified = false): { chargeable: boolean; makeup: boolean } {
  switch (status) {
    case LessonStatus.REALIZADA:
      return { chargeable: true, makeup: false };
    case LessonStatus.FALTA_ALUNO:
      return justified ? { chargeable: false, makeup: true } : { chargeable: true, makeup: false };
    case LessonStatus.FALTA_PROFESSOR:
      return { chargeable: false, makeup: true };
    default:
      return { chargeable: false, makeup: false };
  }
}

/** Aulas que se sobrepõem no mesmo dia (para avisar conflito). */
export function overlappingIds(lessons: Pick<LessonDto, 'id' | 'startsAt' | 'endsAt' | 'status'>[]): Set<string> {
  const active = lessons
    .filter((l) => l.status === LessonStatus.AGENDADA || l.status === LessonStatus.REALIZADA)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const ids = new Set<string>();
  for (let i = 1; i < active.length; i++) {
    for (let j = i - 1; j >= 0; j--) {
      if (active[j].endsAt > active[i].startsAt) {
        ids.add(active[i].id);
        ids.add(active[j].id);
      }
    }
  }
  return ids;
}
