import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Exporta todos os dados do professor (LGPD: portabilidade). Sem hashes de senha nem tokens. */
@Injectable()
export class ExportService {
  constructor(private readonly db: DataSource) {}

  async export(teacherId: string) {
    const q = (sql: string) => this.db.query(sql, [teacherId]);
    const [teacher] = await q(
      `SELECT id, name, email, timezone, pix_key, pix_key_type, lesson_reminder_minutes, payment_reminder_hour,
              default_lesson_minutes, whatsapp_template, created_at FROM teachers WHERE id = $1`,
    );
    return {
      exportedAt: new Date().toISOString(),
      app: 'Aulinha',
      teacher,
      students: await q('SELECT * FROM students WHERE teacher_id = $1 ORDER BY name'),
      billingPlans: await q('SELECT * FROM billing_plans WHERE teacher_id = $1 ORDER BY valid_from'),
      recurringSlots: await q('SELECT * FROM recurring_slots WHERE teacher_id = $1'),
      lessons: await q('SELECT * FROM lessons WHERE teacher_id = $1 ORDER BY starts_at'),
      makeupCredits: await q('SELECT * FROM makeup_credits WHERE teacher_id = $1'),
      scheduleBlocks: await q('SELECT * FROM schedule_blocks WHERE teacher_id = $1'),
      charges: await q('SELECT * FROM charges WHERE teacher_id = $1 ORDER BY due_date'),
      payments: await q('SELECT * FROM payments WHERE teacher_id = $1 ORDER BY paid_at'),
    };
  }
}
