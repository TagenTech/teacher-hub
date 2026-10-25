/**
 * Dados de demonstração para o professor de dev (DEV_TEACHER_EMAIL):
 * 8 alunos, horários fixos, ~4 meses de aulas, cobranças e pagamentos com perfis de atraso.
 *
 *   pnpm api:seed-demo            # apaga os alunos do professor de dev e recria
 *
 * Só roda fora de produção.
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  addDays,
  BillingPlanType,
  ChargeKind,
  LessonMode,
  LessonStatus,
  PaymentMethod,
  todayIn,
  weekdayOf,
  zonedToUtc,
  type StudentColor,
} from '@turmei/contracts';
import { AppModule } from '../app.module';
import { BillingPlan } from '../alunos/entities/billing-plan.entity';
import { Student } from '../alunos/entities/student.entity';
import { StudentsService } from '../alunos/students.service';
import { Lesson } from '../agenda/entities/lesson.entity';
import { ScheduleBlock } from '../agenda/entities/schedule-block.entity';
import { SlotsService } from '../agenda/slots.service';
import { BillingService } from '../financeiro/billing.service';
import { Charge } from '../financeiro/entities/charge.entity';
import { Payment } from '../financeiro/entities/payment.entity';
import { TeachersService } from '../professor/teachers.service';

type Payer = 'pontual' | 'as-vezes' | 'atrasa' | 'devendo';

interface Demo {
  name: string;
  nickname?: string;
  color: StudentColor;
  emoji: string;
  phone: string;
  birth?: string;
  guardian?: { name: string; phone: string };
  tags: string[];
  plan: { type: BillingPlanType; monthly?: number; lesson?: number; pkg?: [number, number]; dueDay?: number };
  slots: { weekday: number; time: string; min: number; mode: LessonMode; location?: string }[];
  payer: Payer;
  absenceRate: number;
}

const DEMO: Demo[] = [
  { name: 'Ana Clara Souza', nickname: 'Aninha', color: 'rosa', emoji: '🎹', phone: '11987654321', birth: '2014-11-02', guardian: { name: 'Marta Souza', phone: '11912345678' }, tags: ['piano', 'infantil'], plan: { type: BillingPlanType.MENSAL, monthly: 28000, dueDay: 10 }, slots: [{ weekday: 2, time: '17:00', min: 60, mode: LessonMode.PRESENCIAL, location: 'Estúdio' }], payer: 'pontual', absenceRate: 0.05 },
  { name: 'Pedro Henrique Lima', color: 'ceu', emoji: '🎸', phone: '21998887777', tags: ['violão', 'online'], plan: { type: BillingPlanType.POR_AULA, lesson: 9000, dueDay: 5 }, slots: [{ weekday: 4, time: '19:00', min: 60, mode: LessonMode.ONLINE }], payer: 'as-vezes', absenceRate: 0.15 },
  { name: 'Júlia Martins', color: 'menta', emoji: '🎤', phone: '31987651234', birth: '2001-03-15', tags: ['canto'], plan: { type: BillingPlanType.PACOTE, pkg: [8, 56000] }, slots: [{ weekday: 1, time: '18:30', min: 45, mode: LessonMode.PRESENCIAL, location: 'Estúdio' }], payer: 'pontual', absenceRate: 0.1 },
  { name: 'Lucas Oliveira', color: 'lavanda', emoji: '🥁', phone: '11955554444', guardian: { name: 'Renata Oliveira', phone: '11944443333' }, tags: ['bateria', 'infantil'], plan: { type: BillingPlanType.MENSAL, monthly: 32000, dueDay: 5 }, slots: [{ weekday: 3, time: '16:00', min: 60, mode: LessonMode.PRESENCIAL, location: 'Casa do aluno' }], payer: 'atrasa', absenceRate: 0.2 },
  { name: 'Beatriz Costa', nickname: 'Bia', color: 'pessego', emoji: '🎻', phone: '11966665555', tags: ['violino'], plan: { type: BillingPlanType.MENSAL, monthly: 30000, dueDay: 15 }, slots: [{ weekday: 2, time: '19:30', min: 60, mode: LessonMode.PRESENCIAL, location: 'Estúdio' }, { weekday: 5, time: '19:30', min: 60, mode: LessonMode.PRESENCIAL, location: 'Estúdio' }], payer: 'as-vezes', absenceRate: 0.08 },
  { name: 'Rafael Mendes', color: 'limao', emoji: '💻', phone: '41977776666', tags: ['teoria', 'online'], plan: { type: BillingPlanType.POR_AULA, lesson: 8000, dueDay: 10 }, slots: [{ weekday: 1, time: '20:00', min: 50, mode: LessonMode.ONLINE }], payer: 'devendo', absenceRate: 0.25 },
  { name: 'Sofia Ribeiro', color: 'lilas', emoji: '🦋', phone: '11933332222', birth: '2012-10-24', guardian: { name: 'Carla Ribeiro', phone: '11922221111' }, tags: ['piano', 'infantil'], plan: { type: BillingPlanType.MENSAL, monthly: 26000, dueDay: 10 }, slots: [{ weekday: 4, time: '17:30', min: 45, mode: LessonMode.PRESENCIAL, location: 'Estúdio' }], payer: 'pontual', absenceRate: 0.05 },
  { name: 'Gabriel Santos', nickname: 'Gabi', color: 'coral', emoji: '🎺', phone: '11911110000', tags: ['trompete'], plan: { type: BillingPlanType.MENSAL, monthly: 29000, dueDay: 20 }, slots: [{ weekday: 6, time: '10:00', min: 60, mode: LessonMode.PRESENCIAL, location: 'Estúdio' }], payer: 'atrasa', absenceRate: 0.12 },
];

// Gerador pseudoaleatório determinístico (mesmos dados a cada execução).
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

function lateDays(p: Payer): number | null {
  switch (p) {
    case 'pontual':
      return rand() < 0.9 ? -Math.floor(rand() * 3) : 2;
    case 'as-vezes':
      return rand() < 0.55 ? 0 : 2 + Math.floor(rand() * 8);
    case 'atrasa':
      return 5 + Math.floor(rand() * 16);
    case 'devendo':
      return rand() < 0.4 ? null : 8 + Math.floor(rand() * 15);
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('seed-demo não roda em produção');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const teachers = app.get(TeachersService);
  const studentsSvc = app.get(StudentsService);
  const slotsSvc = app.get(SlotsService);
  const billing = app.get(BillingService);
  const db = app.get(DataSource);
  const repo = <T extends object>(e: new () => T) => app.get<Repository<T>>(getRepositoryToken(e));

  const email = process.env.DEV_TEACHER_EMAIL;
  const teacher = email ? await teachers.findByEmailWithPassword(email) : null;
  if (!teacher) throw new Error('Rode antes: pnpm api:create-teacher');
  const tz = teacher.timezone;
  const today = todayIn(tz);
  const start = addDays(today, -120);

  console.log('Limpando alunos do professor de demonstração…');
  await repo(Student).delete({ teacherId: teacher.id });
  const scheduleBlocksTable = db.getMetadata(ScheduleBlock).tableName;
  await db.query(`DELETE FROM "${scheduleBlocksTable}" WHERE teacher_id = $1`, [teacher.id]);

  for (const d of DEMO) {
    const st = await studentsSvc.create(teacher.id, {
      name: d.name,
      nickname: d.nickname ?? null,
      phone: d.phone,
      birthDate: d.birth ?? null,
      guardianName: d.guardian?.name ?? null,
      guardianPhone: d.guardian?.phone ?? null,
      payerIsGuardian: !!d.guardian,
      color: d.color,
      emoji: d.emoji,
      tags: d.tags,
      startDate: start,
      plan: {
        type: d.plan.type,
        monthlyFeeCents: d.plan.monthly ?? null,
        lessonPriceCents: d.plan.lesson ?? null,
        packageLessons: d.plan.pkg?.[0] ?? null,
        packagePriceCents: d.plan.pkg?.[1] ?? null,
        dueDay: d.plan.dueDay ?? null,
      },
    });
    // Plano "cadastrado" no início do histórico, para gerar as mensalidades passadas.
    await repo(BillingPlan).update({ studentId: st.id }, { createdAt: new Date(`${start}T12:00:00Z`) });
    await repo(Charge).delete({ studentId: st.id });

    for (const s of d.slots) {
      const slot = await slotsSvc.create(teacher.id, st.id, {
        weekday: s.weekday,
        startTime: s.time,
        durationMin: s.min,
        mode: s.mode,
        location: s.location ?? null,
        meetingUrl: s.mode === LessonMode.ONLINE ? 'https://meet.google.com/aul-inha-demo' : null,
        validFrom: start,
      });
      // Aulas passadas com presença marcada.
      const rows: Partial<Lesson>[] = [];
      let day = addDays(start, (s.weekday - weekdayOf(start) + 7) % 7);
      for (; day < today; day = addDays(day, 7)) {
        const startsAt = zonedToUtc(day, s.time, tz);
        const r = rand();
        const status =
          r < d.absenceRate ? LessonStatus.FALTA_ALUNO : r < d.absenceRate + 0.03 ? LessonStatus.FALTA_PROFESSOR : LessonStatus.REALIZADA;
        const justified = status === LessonStatus.FALTA_ALUNO && rand() < 0.5;
        const chargeable = status === LessonStatus.REALIZADA || (status === LessonStatus.FALTA_ALUNO && !justified);
        const price =
          d.plan.type === BillingPlanType.POR_AULA ? d.plan.lesson! : d.plan.type === BillingPlanType.PACOTE ? Math.round(d.plan.pkg![1] / d.plan.pkg![0]) : null;
        rows.push({
          teacherId: teacher.id,
          studentId: st.id,
          slotId: slot.id,
          occurrenceDate: day,
          startsAt,
          endsAt: new Date(startsAt.getTime() + s.min * 60_000),
          status,
          justified,
          absenceReason: status === LessonStatus.FALTA_ALUNO ? (['Doente', 'Viagem', 'Compromisso', 'Esqueceu'][Math.floor(rand() * 4)]) : status === LessonStatus.FALTA_PROFESSOR ? 'Imprevisto' : null,
          chargeable,
          priceCents: chargeable ? price : null,
          mode: s.mode,
          location: s.location ?? null,
          markedAt: new Date(startsAt.getTime() + s.min * 60_000),
          content: status === LessonStatus.REALIZADA && rand() < 0.3 ? 'Revisão e repertório novo' : null,
        });
      }
      if (rows.length) await repo(Lesson).createQueryBuilder().insert().values(rows).orIgnore().execute();
    }

    // Pacotes: consome as aulas passadas em ordem.
    if (d.plan.type === BillingPlanType.PACOTE) {
      const past = await repo(Lesson).find({ where: { studentId: st.id, chargeable: true, status: In([LessonStatus.REALIZADA, LessonStatus.FALTA_ALUNO]) }, order: { startsAt: 'ASC' } });
      for (const l of past) await billing.onLessonMarked({ teacherId: teacher.id, lessonId: l.id });
    }
  }

  // Mensalidades e fechamentos dos meses passados.
  await billing.generate(teacher.id);

  // Pagamentos conforme o perfil de cada aluno.
  const byName = new Map(DEMO.map((d) => [d.name, d]));
  const charges = await repo(Charge).find({ where: { teacherId: teacher.id }, relations: { student: true }, order: { dueDate: 'ASC' } });
  // Pacote: a data da cobrança = primeira aula do pacote.
  for (const c of charges.filter((x) => x.kind === ChargeKind.PACOTE)) {
    const first = await repo(Lesson).findOne({ where: { chargeId: c.id }, order: { startsAt: 'ASC' } });
    if (first) {
      c.dueDate = first.occurrenceDate ?? c.dueDate;
      await repo(Charge).save(c);
    }
  }
  let n = 0;
  const methods = [PaymentMethod.PIX, PaymentMethod.PIX, PaymentMethod.PIX, PaymentMethod.DINHEIRO, PaymentMethod.TRANSFERENCIA, PaymentMethod.CARTAO];
  for (const c of charges) {
    const d = byName.get(c.student.name)!;
    if (c.dueDate > today) continue;
    const late = lateDays(d.payer);
    if (late === null) continue;
    const paidAt = addDays(c.dueDate, late);
    if (paidAt > today) continue;
    await repo(Payment).save(
      repo(Payment).create({
        teacherId: teacher.id,
        chargeId: c.id,
        amountCents: c.amountCents - c.discountCents,
        paidAt,
        method: methods[Math.floor(rand() * methods.length)],
        note: null,
        receiptNumber: String(++n).padStart(6, '0'),
      }),
    );
  }

  console.log(`Pronto: ${DEMO.length} alunos, ${charges.length} cobranças, ${n} pagamentos.`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
