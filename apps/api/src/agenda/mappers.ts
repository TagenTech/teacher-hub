import type { LessonDto, MakeupCreditDto, ScheduleBlockDto, SlotDto } from '@turmei/contracts';
import { toStudentRef } from '../common/utils/student-ref';
import type { Lesson } from './entities/lesson.entity';
import type { MakeupCredit } from './entities/makeup-credit.entity';
import type { RecurringSlot } from './entities/recurring-slot.entity';
import type { ScheduleBlock } from './entities/schedule-block.entity';

export function toLessonDto(l: Lesson): LessonDto {
  return {
    id: l.id,
    student: toStudentRef(l.student),
    slotId: l.slotId,
    startsAt: l.startsAt.toISOString(),
    endsAt: l.endsAt.toISOString(),
    durationMin: Math.round((l.endsAt.getTime() - l.startsAt.getTime()) / 60_000),
    status: l.status,
    mode: l.mode,
    location: l.location,
    meetingUrl: l.meetingUrl,
    justified: l.justified,
    absenceReason: l.absenceReason,
    chargeable: l.chargeable,
    priceCents: l.priceCents,
    content: l.content,
    homework: l.homework,
    makeupCreditId: l.makeupCreditId,
    rescheduledFromId: l.rescheduledFromId,
    chargeId: l.chargeId,
    markedAt: l.markedAt?.toISOString() ?? null,
  };
}

export function toSlotDto(s: RecurringSlot): SlotDto {
  return {
    id: s.id,
    studentId: s.studentId,
    weekday: s.weekday,
    startTime: s.startTime,
    durationMin: s.durationMin,
    mode: s.mode,
    location: s.location,
    meetingUrl: s.meetingUrl,
    validFrom: s.validFrom,
    validTo: s.validTo,
  };
}

export function toMakeupDto(c: MakeupCredit, origin?: Lesson | null): MakeupCreditDto {
  return {
    id: c.id,
    student: toStudentRef(c.student),
    originLessonId: c.originLessonId,
    originStartsAt: origin?.startsAt.toISOString() ?? null,
    reason: c.reason,
    status: c.status,
    usedLessonId: c.usedLessonId,
    createdAt: c.createdAt.toISOString(),
  };
}

export function toBlockDto(b: ScheduleBlock): ScheduleBlockDto {
  return { id: b.id, startDate: b.startDate, endDate: b.endDate, reason: b.reason, createdAt: b.createdAt.toISOString() };
}
