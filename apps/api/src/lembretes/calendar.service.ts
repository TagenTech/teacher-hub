import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { addDays, displayName, LessonStatus, todayIn, zonedToUtc, type CalendarFeedDto } from '@turmei/contracts';
import { Lesson } from '../agenda/entities/lesson.entity';
import { TeachersService } from '../professor/teachers.service';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Feed .ics: o calendário do celular toca o alarme de cada aula, mesmo com o app fechado. */
@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    private readonly teachers: TeachersService,
    private readonly config: ConfigService,
  ) {}

  async feedInfo(teacherId: string, rotate = false): Promise<CalendarFeedDto> {
    const t = await this.teachers.findById(teacherId);
    const token = rotate || !t.icsToken ? await this.teachers.rotateIcsToken(teacherId) : t.icsToken;
    const base = this.config.get<string>('publicWebUrl')!;
    const url = `${base}/api/v1/calendar/${token}.ics`;
    return { url, webcalUrl: url.replace(/^https?:/, 'webcal:') };
  }

  async ics(token: string): Promise<string> {
    const t = await this.teachers.findByIcsToken(token);
    if (!t) throw new NotFoundException();
    const today = todayIn(t.timezone);
    const lessons = await this.lessons
      .createQueryBuilder('l')
      .innerJoinAndSelect('l.student', 's')
      .where('l.teacherId = :id', { id: t.id })
      .andWhere({ status: In([LessonStatus.AGENDADA, LessonStatus.REALIZADA]) })
      .andWhere('l.startsAt >= :from AND l.startsAt < :to', {
        from: zonedToUtc(addDays(today, -14), '00:00', t.timezone),
        to: zonedToUtc(addDays(today, 60), '00:00', t.timezone),
      })
      .orderBy('l.startsAt', 'ASC')
      .getMany();

    const now = stamp(new Date());
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Turmei//Agenda//PT-BR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Turmei · Aulas',
      `X-WR-TIMEZONE:${t.timezone}`,
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
    ];
    for (const l of lessons) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${l.id}@turmei`,
        `DTSTAMP:${now}`,
        `DTSTART:${stamp(l.startsAt)}`,
        `DTEND:${stamp(l.endsAt)}`,
        `SUMMARY:${esc(`🎵 Aula · ${displayName(l.student)}`)}`,
      );
      if (l.mode === 'ONLINE') lines.push('LOCATION:Online');
      else if (l.location) lines.push(`LOCATION:${esc(l.location)}`);
      if (l.meetingUrl) lines.push(`URL:${esc(l.meetingUrl)}`, `DESCRIPTION:${esc(`Chamada: ${l.meetingUrl}`)}`);
      if (l.status === LessonStatus.AGENDADA && t.lessonReminderMinutes) {
        lines.push(
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:${esc(`Aula com ${displayName(l.student)}`)}`,
          `TRIGGER:-PT${t.lessonReminderMinutes}M`,
          'END:VALARM',
        );
      }
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }
}
