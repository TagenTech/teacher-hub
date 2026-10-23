/**
 * Funcionalidades do dia a dia contra um Postgres real: lembretes (D-1, atraso, aniversário, pacote),
 * bloqueios de agenda, reposições, remarcação, ranking de atrasos, frequência e filtros salvos.
 *   pnpm --filter @aulinha/api test:e2e
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { addDays, todayIn, weekdayOf, type PushPayload } from '@aulinha/contracts';
import { DataSource } from 'typeorm';
import { SlotsService } from '../src/agenda/slots.service';
import { BillingService } from '../src/financeiro/billing.service';
import { PushService } from '../src/lembretes/push.service';
import { RemindersService } from '../src/lembretes/reminders.service';
import { TeachersService } from '../src/professor/teachers.service';
import { createTestApp } from './helpers';

describe('Funcionalidades (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let token = '';
  let teacherId = '';
  const today = todayIn();
  const auth = () => ({ authorization: `Bearer ${token}` });
  /** Notificações "enviadas" (o push real é substituído por um espião). */
  let pushed: { teacherId: string; payload: PushPayload }[] = [];

  const newStudent = async (name: string, plan: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    const res = await http
      .post('/v1/students')
      .set(auth())
      .send({ name, startDate: addDays(today, -90), plan, ...extra })
      .expect(201);
    return res.body.id as string;
  };
  const newLesson = async (studentId: string, daysAgo: number, body: Record<string, unknown> = {}) => {
    const startsAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
    const res = await http
      .post('/v1/lessons')
      .set(auth())
      .send({ studentId, startsAt, durationMin: 60, mode: 'PRESENCIAL', ...body })
      .expect(201);
    return res.body as { id: string; chargeable: boolean; makeupCreditId: string | null };
  };
  const mark = (lessonId: string, body: Record<string, unknown>) =>
    http.post(`/v1/lessons/${lessonId}/attendance`).set(auth()).send(body).expect(200);
  const credits = async (studentId: string) =>
    (await http.get(`/v1/makeup-credits?studentId=${studentId}`).set(auth()).expect(200)).body as {
      id: string;
      status: string;
      originLessonId: string;
      usedLessonId: string | null;
    }[];
  const titles = () => pushed.filter((p) => p.teacherId === teacherId).map((p) => p.payload.title);
  const waitFor = async (check: () => boolean, ms = 3000) => {
    for (const end = Date.now() + ms; Date.now() < end; ) {
      if (check()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  beforeAll(async () => {
    app = await createTestApp();
    const { teacher } = await app.get(TeachersService).upsert('Prof Recursos', 'recursos@aulinha.test', 'senha-recursos-123');
    teacherId = teacher.id;
    http = request(app.getHttpServer());
    token = (await http.post('/v1/auth/login').send({ email: 'recursos@aulinha.test', password: 'senha-recursos-123' }).expect(200)).body
      .accessToken;
    jest.spyOn(app.get(PushService), 'send').mockImplementation(async (id: string, payload: PushPayload) => {
      pushed.push({ teacherId: id, payload });
      return 1;
    });
  });

  beforeEach(() => {
    pushed = [];
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('lembretes', () => {
    // Um dia fixo no futuro, longe do "hoje" real, para o cron de verdade não interferir.
    const day = '2030-03-10';
    const noon = new Date('2030-03-10T15:00:00Z'); // 12:00 em São Paulo
    const morning = new Date('2030-03-10T09:00:00Z'); // 06:00 em São Paulo
    const run = async (now: Date) => {
      const service = app.get(RemindersService);
      await service.forTeacher(await app.get(TeachersService).findById(teacherId), now);
    };
    const charge = (studentId: string, dueDate: string, amountCents = 15000) =>
      http
        .post('/v1/charges')
        .set(auth())
        .send({ studentId, description: 'Material', amountCents, dueDate })
        .expect(201)
        .then((r) => r.body.id as string);

    beforeAll(async () => {
      const ana = await newStudent('Ana Lembrete', { type: 'POR_AULA', lessonPriceCents: 10000, dueDay: 10 }, { birthDate: '2001-03-10' });
      const bia = await newStudent('Bia Pagadora', { type: 'POR_AULA', lessonPriceCents: 10000, dueDay: 10 });
      const caio = await newStudent('Caio Atrasado', { type: 'POR_AULA', lessonPriceCents: 10000, dueDay: 10 });
      await charge(ana, addDays(day, 1));
      // Já paga: não deve gerar lembrete.
      const paid = await charge(bia, addDays(day, 1), 5000);
      await http.post(`/v1/charges/${paid}/payments`).set(auth()).send({ amountCents: 5000, paidAt: today, method: 'PIX' }).expect(201);
      await charge(caio, addDays(day, -1));
    });

    it('nada de pagamento antes do horário escolhido pelo professor', async () => {
      await run(morning);
      expect(titles().some((t) => t.startsWith('💸') || t.startsWith('⏰') || t.startsWith('🎂'))).toBe(false);
    });

    it('avisa no dia anterior ao vencimento (D-1), só o que está em aberto e uma vez por dia', async () => {
      await run(noon);
      await run(new Date(noon.getTime() + 3600_000));
      const d1 = titles().filter((t) => t.startsWith('💸'));
      expect(d1).toEqual(['💸 Vence amanhã: Ana Lembrete']);
      const body = pushed.find((p) => p.payload.title.startsWith('💸'))!.payload;
      expect(body.body).toContain('150,00');
      expect(body.url).toBe('/financeiro?status=abertas');
      // No mesmo dia: o que venceu ontem vira aviso de atraso.
      expect(titles().filter((t) => t.startsWith('⏰'))).toEqual(['⏰ Pagamento atrasado: Caio Atrasado']);
    });

    it('avisa o atraso no dia seguinte ao vencimento', async () => {
      await run(new Date('2030-03-11T15:00:00Z'));
      expect(titles().some((t) => t.startsWith('⏰'))).toBe(false);
      await run(new Date('2030-03-12T15:00:00Z'));
      const late = pushed.filter((p) => p.payload.title.startsWith('⏰'));
      expect(late.map((p) => p.payload.title)).toEqual(['⏰ Pagamento atrasado: Ana Lembrete']);
      expect(late[0].payload.url).toBe('/financeiro?status=atrasadas');
    });

    it('lembra o aniversário do aluno, uma vez no dia', async () => {
      await run(noon);
      // Já avisado no teste do D-1 (mesmo dia): roda num ano seguinte.
      await run(new Date('2031-03-10T15:00:00Z'));
      await run(new Date('2031-03-10T16:00:00Z'));
      expect(titles().filter((t) => t.startsWith('🎂'))).toEqual(['🎂 Hoje é aniversário de Ana Lembrete!']);
    });

    it('aluno inativo não gera lembrete', async () => {
      const dani = await newStudent('Dani Inativa', { type: 'POR_AULA', lessonPriceCents: 10000, dueDay: 10 }, { birthDate: '2000-03-12' });
      await charge(dani, '2030-03-13');
      await http.post(`/v1/students/${dani}/status`).set(auth()).send({ status: 'INATIVO' }).expect(200);
      await run(new Date('2030-03-12T15:00:00Z'));
      expect(titles().some((t) => t.includes('Dani'))).toBe(false);
    });

    it('pacote: avisa quando falta uma aula, quando termina e renova na aula seguinte', async () => {
      const edu = await newStudent('Edu Pacote', { type: 'PACOTE', packageLessons: 3, packagePriceCents: 30000 });
      const lessons = [];
      for (const d of [8, 6, 4, 2]) lessons.push(await newLesson(edu, d));

      await mark(lessons[0].id, { status: 'REALIZADA' });
      await mark(lessons[1].id, { status: 'REALIZADA' });
      await waitFor(() => titles().some((t) => t.startsWith('📦')));
      expect(titles()).toContain('📦 Pacote de Edu Pacote acaba na próxima aula');

      await mark(lessons[2].id, { status: 'REALIZADA' });
      await waitFor(() => titles().includes('📦 Pacote de Edu Pacote terminou'));
      expect(titles()).toContain('📦 Pacote de Edu Pacote terminou');

      await mark(lessons[3].id, { status: 'REALIZADA' });
      const charges = (await http.get(`/v1/charges?studentId=${edu}`).set(auth()).expect(200)).body as { description: string; amountCents: number }[];
      expect(charges.map((c) => c.description).sort()).toEqual(['Pacote de 3 aulas', 'Pacote de 3 aulas (renovação)']);
      expect(charges.every((c) => c.amountCents === 30000)).toBe(true);
      // Cada aviso sai uma vez só.
      expect(titles().filter((t) => t.startsWith('📦'))).toHaveLength(2);
    });
  });

  describe('agenda', () => {
    let fabi = '';
    beforeAll(async () => {
      fabi = await newStudent('Fabi Agenda', { type: 'POR_AULA', lessonPriceCents: 8000, dueDay: 5 });
      await http
        .post(`/v1/students/${fabi}/slots`)
        .set(auth())
        .send({ weekday: weekdayOf(addDays(today, 3)), startTime: '10:00', durationMin: 60, mode: 'PRESENCIAL' })
        .expect(201);
    });
    const lessonsBetween = async (from: string, to: string) =>
      (await http.get(`/v1/lessons?from=${from}&to=${to}&studentId=${fabi}`).set(auth()).expect(200)).body as {
        id: string;
        status: string;
        chargeable: boolean;
      }[];

    it('bloqueio (férias) cancela as aulas do período, gera reposições e desfaz ao remover', async () => {
      const from = addDays(today, 1);
      const to = addDays(today, 14);
      await http.post('/v1/schedule-blocks').set(auth()).send({ startDate: to, endDate: from, reason: 'Férias' }).expect(400);
      const created = await http
        .post('/v1/schedule-blocks')
        .set(auth())
        .send({ startDate: from, endDate: to, reason: 'Férias', createMakeups: true })
        .expect(201);
      expect(created.body.canceled).toBe(2);

      const inBlock = await lessonsBetween(from, to);
      expect(inBlock).toHaveLength(2);
      expect(inBlock.every((l) => l.status === 'CANCELADA' && !l.chargeable)).toBe(true);
      // Aulas fora do período continuam agendadas.
      const after = await lessonsBetween(addDays(to, 1), addDays(to, 21));
      expect(after.length).toBeGreaterThan(0);
      expect(after.every((l) => l.status === 'AGENDADA')).toBe(true);

      const open = (await credits(fabi)).filter((c) => c.status === 'ABERTO');
      expect(open).toHaveLength(2);

      await http.delete(`/v1/schedule-blocks/${created.body.block.id}`).set(auth()).expect(204);
      const restored = await lessonsBetween(from, to);
      expect(restored.every((l) => l.status === 'AGENDADA' && l.chargeable)).toBe(true);
      expect((await credits(fabi)).every((c) => c.status === 'CANCELADO')).toBe(true);
    });

    it('falta do aluno: sem justificativa é cobrada; com justificativa não é cobrada e vira reposição', async () => {
      const unjustified = await newLesson(fabi, 10);
      const res = await mark(unjustified.id, { status: 'FALTA_ALUNO' });
      expect(res.body).toMatchObject({ chargeable: true, priceCents: 8000, justified: false });

      const justified = await newLesson(fabi, 9);
      const ok = await mark(justified.id, { status: 'FALTA_ALUNO', justified: true, reason: 'Doente' });
      expect(ok.body).toMatchObject({ chargeable: false, priceCents: null, justified: true, absenceReason: 'Doente' });
      const credit = (await credits(fabi)).find((c) => c.originLessonId === justified.id);
      expect(credit?.status).toBe('ABERTO');

      // Voltar para "agendada" desfaz a reposição.
      await mark(justified.id, { status: 'AGENDADA' });
      expect((await credits(fabi)).find((c) => c.originLessonId === justified.id)?.status).toBe('CANCELADO');
    });

    it('reposição: usa o crédito uma vez, não é cobrada, acompanha a remarcação e volta se cancelada', async () => {
      const missed = await newLesson(fabi, 7);
      await mark(missed.id, { status: 'FALTA_PROFESSOR' });
      const credit = (await credits(fabi)).find((c) => c.originLessonId === missed.id)!;
      expect(credit.status).toBe('ABERTO');

      const startsAt = new Date(Date.now() + 5 * 86_400_000).toISOString();
      const makeup = await http
        .post('/v1/lessons')
        .set(auth())
        .send({ studentId: fabi, startsAt, durationMin: 60, mode: 'ONLINE', makeupCreditId: credit.id })
        .expect(201);
      expect(makeup.body).toMatchObject({ chargeable: false, makeupCreditId: credit.id });
      await http
        .post('/v1/lessons')
        .set(auth())
        .send({ studentId: fabi, startsAt, durationMin: 60, mode: 'ONLINE', makeupCreditId: credit.id })
        .expect(400);
      expect((await credits(fabi)).find((c) => c.id === credit.id)).toMatchObject({ status: 'USADO', usedLessonId: makeup.body.id });

      const moved = await http
        .post(`/v1/lessons/${makeup.body.id}/reschedule`)
        .set(auth())
        .send({ startsAt: new Date(Date.now() + 6 * 86_400_000).toISOString() })
        .expect(200);
      expect(moved.body).toMatchObject({ makeupCreditId: credit.id, rescheduledFromId: makeup.body.id, chargeable: false });
      expect((await credits(fabi)).find((c) => c.id === credit.id)?.usedLessonId).toBe(moved.body.id);
      // A original fica como histórico e não pode ser marcada.
      await http.post(`/v1/lessons/${makeup.body.id}/attendance`).set(auth()).send({ status: 'REALIZADA' }).expect(400);

      await mark(moved.body.id, { status: 'CANCELADA' });
      expect((await credits(fabi)).find((c) => c.id === credit.id)).toMatchObject({ status: 'ABERTO', usedLessonId: null });
    });

    it('relatório de frequência conta realizadas, faltas, justificadas e taxa de presença', async () => {
      const gabi = await newStudent('Gabi Frequência', { type: 'POR_AULA', lessonPriceCents: 9000, dueDay: 5 });
      const plan: [number, Record<string, unknown>][] = [
        [12, { status: 'REALIZADA' }],
        [11, { status: 'REALIZADA' }],
        [10, { status: 'FALTA_ALUNO' }],
        [9, { status: 'FALTA_ALUNO', justified: true }],
        [8, { status: 'FALTA_PROFESSOR' }],
      ];
      for (const [daysAgo, body] of plan) await mark((await newLesson(gabi, daysAgo)).id, body);
      await newLesson(gabi, 1); // ainda não marcada: fora da conta

      const res = await http
        .get(`/v1/reports/attendance?from=${addDays(today, -30)}&to=${today}&studentIds=${gabi}`)
        .set(auth())
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        total: 5,
        realized: 2,
        studentAbsences: 2,
        justifiedAbsences: 1,
        teacherAbsences: 1,
        rate: 50,
      });
      const csv = await http
        .get(`/v1/reports/export.csv?type=frequencia&from=${addDays(today, -30)}&to=${today}&studentIds=${gabi}`)
        .set(auth())
        .expect(200);
      expect(csv.text).toContain('Gabi Frequência;5;2;2;1;1;0;50');
    });
  });

  describe('relatórios', () => {
    it('ranking de atrasos: quem atrasa e deve hoje vem primeiro; quem paga em dia fica "em dia"', async () => {
      const plan = { type: 'POR_AULA', lessonPriceCents: 10000, dueDay: 10 };
      const pontual = await newStudent('Hugo Pontual', plan, { tags: ['ranking'] });
      const atrasado = await newStudent('Iris Atrasa', plan, { tags: ['ranking'] });
      const charge = async (studentId: string, dueDate: string) =>
        (await http.post('/v1/charges').set(auth()).send({ studentId, description: 'Mensal', amountCents: 20000, dueDate }).expect(201)).body
          .id as string;
      const pay = (id: string, paidAt: string) =>
        http.post(`/v1/charges/${id}/payments`).set(auth()).send({ amountCents: 20000, paidAt, method: 'PIX' }).expect(201);

      await pay(await charge(pontual, addDays(today, -20)), addDays(today, -21));
      await pay(await charge(atrasado, addDays(today, -40)), addDays(today, -30));
      await charge(atrasado, addDays(today, -10));

      const res = await http
        .get(`/v1/reports/late-payers?from=${addDays(today, -60)}&to=${today}&tags=ranking`)
        .set(auth())
        .expect(200);
      expect(res.body.map((r: { student: { name: string } }) => r.student.name)).toEqual(['Iris Atrasa', 'Hugo Pontual']);
      expect(res.body[0]).toMatchObject({
        chargesCount: 2,
        lateCount: 2,
        latePct: 100,
        maxDaysLate: 10,
        overdueCents: 20000,
        overdueCount: 1,
        badge: 'SEMPRE',
      });
      expect(res.body[1]).toMatchObject({ lateCount: 0, latePct: 0, overdueCents: 0, badge: 'EM_DIA' });

      const onlyLate = await http
        .get(`/v1/reports/late-payers?from=${addDays(today, -60)}&to=${today}&tags=ranking&onlyLate=true`)
        .set(auth())
        .expect(200);
      expect(onlyLate.body).toHaveLength(1);
    });

    it('filtros salvos: cria, lista fixados primeiro, edita, apaga e não vaza para outra conta', async () => {
      const criteria = { tags: ['ranking'], onlyLate: true };
      await http.post('/v1/saved-filters').set(auth()).send({ name: '  ', period: 'mes', criteria }).expect(400);
      await http.post('/v1/saved-filters').set(auth()).send({ name: 'Período errado', period: 'semana', criteria }).expect(400);
      const a = await http.post('/v1/saved-filters').set(auth()).send({ name: 'Devedores', period: '3-meses', criteria, pinned: false }).expect(201);
      const b = await http.post('/v1/saved-filters').set(auth()).send({ name: 'Este mês', period: 'mes', criteria: {} }).expect(201);
      expect(a.body).toMatchObject({ name: 'Devedores', period: '3-meses', criteria, pinned: false });

      let list = (await http.get('/v1/saved-filters').set(auth()).expect(200)).body as { id: string; name: string }[];
      expect(list.map((f) => f.name)).toEqual(['Este mês', 'Devedores']);

      await http.patch(`/v1/saved-filters/${a.body.id}`).set(auth()).send({ name: 'Quem deve', pinned: true }).expect(200);
      list = (await http.get('/v1/saved-filters').set(auth()).expect(200)).body;
      expect(list.map((f) => f.name)).toEqual(['Quem deve', 'Este mês']);

      await app.get(TeachersService).upsert('Intrusa', 'intrusa@aulinha.test', 'senha-intrusa-123');
      const other = (await http.post('/v1/auth/login').send({ email: 'intrusa@aulinha.test', password: 'senha-intrusa-123' }).expect(200)).body
        .accessToken;
      await http.patch(`/v1/saved-filters/${a.body.id}`).set({ authorization: `Bearer ${other}` }).send({ name: 'x' }).expect(404);
      await http.delete(`/v1/saved-filters/${a.body.id}`).set({ authorization: `Bearer ${other}` });
      expect((await http.get('/v1/saved-filters').set({ authorization: `Bearer ${other}` }).expect(200)).body).toHaveLength(0);

      await http.delete(`/v1/saved-filters/${b.body.id}`).set(auth()).expect(204);
      list = (await http.get('/v1/saved-filters').set(auth()).expect(200)).body;
      expect(list.map((f) => f.name)).toEqual(['Quem deve']);
    });
  });

  describe('tarefas noturnas', () => {
    it('3h: repõe as 8 semanas de aulas do horário fixo sem duplicar', async () => {
      const jo = await newStudent('Jo Noturna', { type: 'POR_AULA', lessonPriceCents: 7000, dueDay: 5 });
      await http
        .post(`/v1/students/${jo}/slots`)
        .set(auth())
        .send({ weekday: weekdayOf(addDays(today, 2)), startTime: '18:00', durationMin: 45, mode: 'ONLINE' })
        .expect(201);
      const count = async () =>
        (await http.get(`/v1/lessons?from=${today}&to=${addDays(today, 60)}&studentId=${jo}`).set(auth()).expect(200)).body.length as number;
      const before = await count();
      expect(before).toBeGreaterThanOrEqual(8);

      // Simula o tempo passando: some a agenda futura e o cron da madrugada gera de novo.
      await app.get(DataSource).query(`DELETE FROM lessons WHERE student_id = $1 AND status = 'AGENDADA'`, [jo]);
      expect(await count()).toBe(0);
      await app.get(SlotsService).generateAll();
      expect(await count()).toBe(before);
      await app.get(SlotsService).generateAll();
      expect(await count()).toBe(before);
    });

    it('4h: gera a mensalidade do plano mensal uma vez só', async () => {
      const kai = await newStudent('Kai Mensal', { type: 'MENSAL', monthlyFeeCents: 25000, dueDay: 15 }, { startDate: today });
      await app.get(DataSource).query(`DELETE FROM charges WHERE student_id = $1`, [kai]);
      // Direto no banco: abrir a lista de cobranças também dispara a geração.
      const list = async () =>
        (await app.get(DataSource).query(`SELECT kind, amount_cents, description FROM charges WHERE student_id = $1`, [kai])) as {
          kind: string;
          amount_cents: number;
          description: string;
        }[];
      expect(await list()).toHaveLength(0);

      await app.get(BillingService).generateAll();
      const first = await list();
      expect(first.length).toBeGreaterThanOrEqual(1);
      expect(first.every((c) => c.kind === 'MENSALIDADE' && c.amount_cents === 25000 && c.description.startsWith('Mensalidade de'))).toBe(true);
      await app.get(BillingService).generateAll();
      expect(await list()).toHaveLength(first.length);
    });
  });
});
