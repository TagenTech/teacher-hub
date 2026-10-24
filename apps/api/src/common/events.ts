/** Eventos internos entre módulos (via @nestjs/event-emitter), evitando dependências circulares. */
import type { StudentStatus } from '@turmei/contracts';

export const Events = {
  STUDENT_STATUS_CHANGED: 'student.status-changed',
  PLAN_CHANGED: 'student.plan-changed',
  LESSON_MARKED: 'lesson.marked',
  PACKAGE_LOW: 'package.low',
} as const;

export interface PackageLowEvent {
  teacherId: string;
  studentId: string;
  chargeId: string;
  remaining: number;
}

export interface StudentStatusChangedEvent {
  teacherId: string;
  studentId: string;
  status: StudentStatus;
  pausedUntil: string | null;
}

export interface PlanChangedEvent {
  teacherId: string;
  studentId: string;
}

export interface LessonMarkedEvent {
  teacherId: string;
  lessonId: string;
}
