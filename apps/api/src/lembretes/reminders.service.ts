import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Not, Repository } from 'typeorm';
import {
  addDays,
  chargeStatus,
  ChargeStatus,
  displayName,
  formatBRL,
  LessonStatus,
  NotificationType,
  StudentStatus,
  zonedParts,
  type PushPayload,
} from '@aulinha/contracts';
import { Student } from '../alunos/entities/student.entity';
import { Lesson } from '../agenda/entities/lesson.entity';
import { Events, type PackageLowEvent } from '../common/events';
import { Charge } from '../financeiro/entities/charge.entity';
import { Teacher } from '../professor/entities/teacher.entity';
import { TeachersService } from '../professor/teachers.service';
import { NotificationLog } from './entities/notification-log.entity';
import { PushService } from './push.service';

const SUMMARY_HOUR = 7;
const BIRTHDAY_HOUR = 8;

/**
 * Um cron por minuto decide o que avisar para cada professor, no fuso dele:
 * aula chegando, resumo do dia, pagamento vencendo amanhã, atraso e aniversário.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private running = false;

  constructor(
    @InjectRepository(NotificationLog) private readonly logs: Repository<NotificationLog>,
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    @InjectRepository(Charge) private readonly charges: Repository<Charge>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    private readonly teachers: TeachersService,
    private readonly push: PushService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      for (const t of await this.teachers.findAll()) {
        await this.forTeacher(t, now).catch((err) => this.logger.error(err));
      }
    } finally {
      this.running = false;
    }
  }

  async forTeacher(t: Teacher, now: Date) {
    const local = zonedParts(now, t.timezone);
    await this.lessonReminders(t, now);
    if (local.minutes >= SUMMARY_HOUR * 60) await this.dailySummary(t, local.date);
    if (local.minutes >= t.paymentReminderHour * 60) await this.paymentReminders(t, local.date);
    if (local.minutes >= BIRTHDAY_HOUR * 60) await this.birthdays(t, local.date);
  }

  private async lessonReminders(t: Teacher, now: Date) {
    if (!t.lessonReminderMinutes) return;
    const upcoming = await this.lessons.find({
      where: {
        teacherId: t.id,
        status: LessonStatus.AGENDADA,
        startsAt: Between(now, new Date(now.getTime() + t.lessonReminderMinutes * 60_000)),
      },
      relations: { student: true },
    });
    for (const l of upcoming) {
      const minutes = Math.max(1, Math.round((l.startsAt.getTime() - now.getTime()) / 60_000));
      const time = zonedParts(l.startsAt, t.timezone).time;
      await this.once(t.id, NotificationType.AULA, l.id, l.startsAt.toISOString(), {
        title: `🎵 Aula com ${displayName(l.student)} em ${minutes} min`,
        body: `${time} · ${l.mode === 'ONLINE' ? 'Online' : (l.location ?? 'Presencial')}${l.meetingUrl ? ' · toque para abrir' : ''}`,
        url: '/hoje',
        tag: `aula-${l.id}`,
        requireInteraction: true,
      });
    }
  }

  private async dailySummary(t: Teacher, today: string) {
    if (await this.logged(NotificationType.RESUMO_DIARIO, t.id, today)) return;
    const { lessons, dueToday } = await this.dayNumbers(t, today);
    // Marca mesmo sem enviar, para não recalcular o dia inteiro.
    if (!lessons && !dueToday) {
      await this.mark(t.id, NotificationType.RESUMO_DIARIO, t.id, today);
      return;
    }
    const parts = [
      lessons ? `${lessons} ${lessons === 1 ? 'aula' : 'aulas'}` : null,
      dueToday ? `${dueToday} pagamento(s) vencendo` : null,
    ].filter(Boolean);
    await this.once(t.id, NotificationType.RESUMO_DIARIO, t.id, today, {
      title: '☀️ Bom dia! Seu dia na Aulinha',
      body: `Hoje: ${parts.join(' · ')}.`,
      url: '/hoje',
      tag: `resumo-${today}`,
    });
  }

  private async paymentReminders(t: Teacher, today: string) {
    const tomorrow = addDays(today, 1);
    const yesterday = addDays(today, -1);
    if (!(await this.logged(NotificationType.PAGAMENTO_D1, t.id, today))) {
      const due = await this.openCharges(t.id, tomorrow, today);
      if (due.length) {
        const first = due[0];
        await this.once(t.id, NotificationType.PAGAMENTO_D1, t.id, today, {
          title: due.length === 1 ? `💸 Vence amanhã: ${displayName(first.student)}` : `💸 ${due.length} pagamentos vencem amanhã`,
          body:
            due.length === 1
              ? `${first.description} · ${formatBRL(first.amountCents - first.discountCents)}. Toque para mandar o lembrete no WhatsApp.`
              : due.map((c) => displayName(c.student)).join(', '),
          url: '/financeiro?status=abertas',
          tag: `d1-${today}`,
        });
      } else {
        await this.mark(t.id, NotificationType.PAGAMENTO_D1, t.id, today);
      }
    }
    if (!(await this.logged(NotificationType.PAGAMENTO_ATRASO, t.id, today))) {
      const late = await this.openCharges(t.id, yesterday, today);
      if (late.length) {
        await this.once(t.id, NotificationType.PAGAMENTO_ATRASO, t.id, today, {
          title: late.length === 1 ? `⏰ Pagamento atrasado: ${displayName(late[0].student)}` : `⏰ ${late.length} pagamentos atrasaram`,
          body: 'Venceu ontem e ainda está em aberto.',
          url: '/financeiro?status=atrasadas',
          tag: `atraso-${today}`,
        });
      } else {
        await this.mark(t.id, NotificationType.PAGAMENTO_ATRASO, t.id, today);
      }
    }
  }

  private async birthdays(t: Teacher, today: string) {
    if (await this.logged(NotificationType.ANIVERSARIO, t.id, today)) return;
    const list = await this.students
      .createQueryBuilder('s')
      .where('s.teacherId = :id AND s.status != :inactive', { id: t.id, inactive: StudentStatus.INATIVO })
      .andWhere("to_char(s.birthDate, 'MM-DD') = :md", { md: today.slice(5) })
      .getMany();
    if (!list.length) {
      await this.mark(t.id, NotificationType.ANIVERSARIO, t.id, today);
      return;
    }
    await this.once(t.id, NotificationType.ANIVERSARIO, t.id, today, {
      title: `🎂 Hoje é aniversário de ${list.map((s) => displayName(s)).join(' e ')}!`,
      body: 'Que tal mandar uma mensagem carinhosa?',
      url: `/alunos/${list[0].id}`,
      tag: `aniversario-${today}`,
    });
  }

  @OnEvent(Events.PACKAGE_LOW, { async: true })
  async onPackageLow(e: PackageLowEvent) {
    const st = await this.students.findOne({ where: { id: e.studentId } });
    if (!st) return;
    await this.once(e.teacherId, NotificationType.PACOTE_ACABANDO, e.chargeId, String(e.remaining), {
      title: e.remaining ? `📦 Pacote de ${displayName(st)} acaba na próxima aula` : `📦 Pacote de ${displayName(st)} terminou`,
      body: 'A próxima aula já abre um novo pacote para cobrar.',
      url: `/alunos/${st.id}`,
      tag: `pacote-${e.chargeId}`,
    });
  }

  async test(teacherId: string) {
    return this.push.send(teacherId, {
      title: '🔔 Lembretes ativados!',
      body: 'É assim que a Aulinha vai te avisar das aulas e pagamentos.',
      url: '/mais/lembretes',
      tag: 'teste',
    });
  }

  private async dayNumbers(t: Teacher, today: string) {
    const lessons = await this.lessons
      .createQueryBuilder('l')
      .where('l.teacherId = :id AND l.status = :st', { id: t.id, st: LessonStatus.AGENDADA })
      .andWhere("(l.startsAt AT TIME ZONE :tz)::date = :today", { tz: t.timezone, today })
      .getCount();
    const dueToday = (await this.openCharges(t.id, today, today)).length;
    return { lessons, dueToday };
  }

  private async openCharges(teacherId: string, dueDate: string, today: string) {
    const rows = await this.charges.find({
      where: { teacherId, dueDate, canceledAt: IsNull(), student: { status: Not(In([StudentStatus.INATIVO])) } },
      relations: { student: true, payments: true },
    });
    return rows.filter((c) => {
      const paid = (c.payments ?? []).reduce((s, p) => s + p.amountCents, 0);
      const st = chargeStatus(c, paid, today);
      return st !== ChargeStatus.PAGO && st !== ChargeStatus.CANCELADO;
    });
  }

  private logged(type: NotificationType, refId: string, key: string) {
    return this.logs.exist({ where: { type, refId, key } });
  }

  private async mark(teacherId: string, type: NotificationType, refId: string, key: string): Promise<boolean> {
    const res = await this.logs.createQueryBuilder().insert().into(NotificationLog).values({ teacherId, type, refId, key }).orIgnore().execute();
    return res.identifiers.filter(Boolean).length > 0;
  }

  /** Grava o log primeiro (idempotente) e só então envia. */
  private async once(teacherId: string, type: NotificationType, refId: string, key: string, payload: PushPayload) {
    if (!(await this.mark(teacherId, type, refId, key))) return;
    await this.push.send(teacherId, payload);
  }
}
