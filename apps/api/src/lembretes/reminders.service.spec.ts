import type { Repository } from 'typeorm';
import type { Student } from '../alunos/entities/student.entity';
import type { Lesson } from '../agenda/entities/lesson.entity';
import type { Charge } from '../financeiro/entities/charge.entity';
import type { Teacher } from '../professor/entities/teacher.entity';
import type { TeachersService } from '../professor/teachers.service';
import type { NotificationLog } from './entities/notification-log.entity';
import type { PushService } from './push.service';
import { RemindersService } from './reminders.service';

describe('RemindersService', () => {
  const teacher = {
    id: 't1',
    timezone: 'America/Sao_Paulo',
    lessonReminderMinutes: 30,
    paymentReminderHour: 9,
  } as Teacher;
  // 10:00 em São Paulo
  const now = new Date('2026-10-23T13:00:00Z');
  const lesson = {
    id: 'l1',
    startsAt: new Date('2026-10-23T13:20:00Z'),
    mode: 'PRESENCIAL',
    location: 'Estúdio',
    meetingUrl: null,
    student: { name: 'Ana Clara', nickname: 'Aninha' },
  } as unknown as Lesson;

  let sent: { title: string }[];
  let keys: Set<string>;
  let service: RemindersService;

  beforeEach(() => {
    sent = [];
    keys = new Set();
    const logs = {
      exist: jest.fn(async ({ where }: { where: { type: string; refId: string; key: string } }) =>
        keys.has(`${where.type}|${where.refId}|${where.key}`),
      ),
      createQueryBuilder: () => {
        let v: { type: string; refId: string; key: string };
        const qb = {
          insert: () => qb,
          into: () => qb,
          values: (x: typeof v) => ((v = x), qb),
          orIgnore: () => qb,
          execute: async () => {
            const k = `${v.type}|${v.refId}|${v.key}`;
            const fresh = !keys.has(k);
            keys.add(k);
            return { identifiers: fresh ? [{ id: 'x' }] : [] };
          },
        };
        return qb;
      },
    } as unknown as Repository<NotificationLog>;
    const lessons = {
      find: jest.fn(async () => [lesson]),
      createQueryBuilder: () => {
        const qb = { where: () => qb, andWhere: () => qb, getCount: async () => 2 };
        return qb;
      },
    } as unknown as Repository<Lesson>;
    const charges = { find: jest.fn(async () => []) } as unknown as Repository<Charge>;
    const students = {
      createQueryBuilder: () => {
        const qb = { where: () => qb, andWhere: () => qb, getMany: async () => [] };
        return qb;
      },
    } as unknown as Repository<Student>;
    const push = { send: jest.fn(async (_t: string, p: { title: string }) => (sent.push(p), 1)) } as unknown as PushService;
    service = new RemindersService(logs, lessons, charges, students, { findAll: async () => [teacher] } as unknown as TeachersService, push);
  });

  it('avisa a aula que começa dentro da antecedência, uma única vez', async () => {
    await service.forTeacher(teacher, now);
    await service.forTeacher(teacher, new Date(now.getTime() + 60_000));
    const aula = sent.filter((p) => p.title.includes('Aula com Aninha'));
    expect(aula).toHaveLength(1);
    expect(aula[0].title).toBe('🎵 Aula com Aninha em 20 min');
  });

  it('manda o resumo do dia só depois das 7h e uma vez por dia', async () => {
    const early = new Date('2026-10-23T09:00:00Z'); // 06:00 local
    await service.forTeacher(teacher, early);
    expect(sent.some((p) => p.title.includes('Bom dia'))).toBe(false);
    await service.forTeacher(teacher, now);
    await service.forTeacher(teacher, new Date(now.getTime() + 3600_000));
    expect(sent.filter((p) => p.title.includes('Bom dia'))).toHaveLength(1);
  });

  it('não avisa aula quando a antecedência está desligada', async () => {
    await service.forTeacher({ ...teacher, lessonReminderMinutes: 0 } as Teacher, now);
    expect(sent.some((p) => p.title.includes('Aula com'))).toBe(false);
  });
});
