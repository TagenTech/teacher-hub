import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BillingPlan } from '../alunos/entities/billing-plan.entity';
import { Student } from '../alunos/entities/student.entity';
import { Lesson } from '../agenda/entities/lesson.entity';
import { MakeupCredit } from '../agenda/entities/makeup-credit.entity';
import { RecurringSlot } from '../agenda/entities/recurring-slot.entity';
import { ScheduleBlock } from '../agenda/entities/schedule-block.entity';
import { Charge } from '../financeiro/entities/charge.entity';
import { Payment } from '../financeiro/entities/payment.entity';
import { Teacher } from './entities/teacher.entity';

/** Exporta todos os dados do professor (LGPD: portabilidade). Sem hashes de senha nem tokens. */
@Injectable()
export class ExportService {
  constructor(private readonly db: DataSource) {}

  async export(teacherId: string) {
    const table = (entity: new () => object) => `"${this.db.getMetadata(entity).tableName}"`;
    const q = (sql: string) => this.db.query(sql, [teacherId]);
    const [teacher] = await q(
      `SELECT id, name, email, timezone, pix_key, pix_key_type, lesson_reminder_minutes, payment_reminder_hour,
              default_lesson_minutes, whatsapp_template, created_at FROM ${table(Teacher)} WHERE id = $1`,
    );
    return {
      exportedAt: new Date().toISOString(),
      app: 'Turmei',
      teacher,
      students: await q(`SELECT * FROM ${table(Student)} WHERE teacher_id = $1 ORDER BY name`),
      billingPlans: await q(`SELECT * FROM ${table(BillingPlan)} WHERE teacher_id = $1 ORDER BY valid_from`),
      recurringSlots: await q(`SELECT * FROM ${table(RecurringSlot)} WHERE teacher_id = $1`),
      lessons: await q(`SELECT * FROM ${table(Lesson)} WHERE teacher_id = $1 ORDER BY starts_at`),
      makeupCredits: await q(`SELECT * FROM ${table(MakeupCredit)} WHERE teacher_id = $1`),
      scheduleBlocks: await q(`SELECT * FROM ${table(ScheduleBlock)} WHERE teacher_id = $1`),
      charges: await q(`SELECT * FROM ${table(Charge)} WHERE teacher_id = $1 ORDER BY due_date`),
      payments: await q(`SELECT * FROM ${table(Payment)} WHERE teacher_id = $1 ORDER BY paid_at`),
    };
  }
}
