/**
 * Gestão do dia a dia contra um Postgres real: financeiro (editar, cancelar, reabrir, apagar, estorno, recibo,
 * resumo, destaques, prévia), alunos (editar, excluir, reajuste, pausa) e agenda (horário fixo, aula avulsa,
 * pendentes, reposição manual).
 *   pnpm --filter @turmei/api test:e2e
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { addDays, monthOf, todayIn, weekdayOf, zonedParts } from '@turmei/contracts';
import { StudentsService } from '../src/alunos/students.service';
import { RemindersService } from '../src/lembretes/reminders.service';
import { SecurityEventsService } from '../src/security/security-events.service';
import { createTestApp, registerTeacher } from './helpers';

const TZ = 'America/Sao_Paulo';

describe('Gestão (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let auth: { authorization: string };
  const today = todayIn(TZ);
  const month = monthOf(today);

  const newStudent = async (name: string, plan: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    (await http.post('/v1/students').set(auth).send({ name, startDate: addDays(today, -90), plan, ...extra }).expect(201)).body as {
      id: string;
      plans: { id: string; validTo: string | null }[];
    };
  const porAula = (cents = 10000) => ({ type: 'POR_AULA', lessonPriceCents: cents, dueDay: 10 });
  const newLesson = async (studentId: string, startsAt: Date, body: Record<string, unknown> = {}) =>
    (
      await http
        .post('/v1/lessons')
        .set(auth)
        .send({ studentId, startsAt: startsAt.toISOString(), durationMin: 60, mode: 'PRESENCIAL', ...body })
        .expect(201)
    ).body as { id: string };
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  const mark = (id: string, body: Record<string, unknown>) =>
    http.post(`/v1/lessons/${id}/attendance`).set(auth).send(body).expect(200);
  const lessons = async (studentId: string, from = today, to = addDays(today, 56)) =>
    (await http.get(`/v1/lessons?from=${from}&to=${to}&studentId=${studentId}`).set(auth).expect(200)).body as {
      id: string;
      startsAt: string;
      status: string;
      slotId: string | null;
    }[];
  const localTime = (iso: string) => zonedParts(new Date(iso), TZ).time;
  const localDate = (iso: string) => zonedParts(new Date(iso), TZ).date;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    ({ auth } = await registerTeacher(http, 'Prof Gestão', 'gestao@turmei.test'));
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('financeiro', () => {
    let studentId = '';
    beforeAll(async () => {
      studentId = (await newStudent('Lia Financeiro', porAula(), { guardianName: 'Marta Mãe', guardianPhone: '11912345678', payerIsGuardian: true })).id;
    });
    const charge = async (body: Record<string, unknown> = {}) =>
      (
        await http
          .post('/v1/charges')
          .set(auth)
          .send({ studentId, description: 'Material didático', amountCents: 5000, dueDate: addDays(today, 5), ...body })
          .expect(201)
      ).body as { id: string; netCents: number; status: string };
    const get = async (id: string) =>
      (await http.get(`/v1/charges/${id}`).set(auth).expect(200)).body as {
        status: string;
        netCents: number;
        balanceCents: number;
        payments: { id: string; receiptNumber: string }[];
      };
    const pay = (id: string, amountCents: number) =>
      http.post(`/v1/charges/${id}/payments`).set(auth).send({ amountCents, paidAt: today, method: 'PIX' });

    it('editar cobrança: desconto muda o líquido; desconto maior que o valor é recusado', async () => {
      const c = await charge();
      const edited = await http
        .patch(`/v1/charges/${c.id}`)
        .set(auth)
        .send({ description: 'Apostila', discountCents: 1000, dueDate: addDays(today, 6) })
        .expect(200);
      expect(edited.body).toMatchObject({ description: 'Apostila', netCents: 4000, balanceCents: 4000, dueDate: addDays(today, 6) });
      await http.patch(`/v1/charges/${c.id}`).set(auth).send({ discountCents: 9000 }).expect(400);
    });

    it('estorno, recibo (em nome do responsável), cancelar, reabrir e apagar', async () => {
      const c = await charge();
      const paid = await pay(c.id, 5000).expect(201);
      expect(paid.body.status).toBe('PAGO');
      await pay(c.id, 1).expect(400);
      const paymentId = paid.body.payments[0].id as string;

      const receipt = await http.get(`/v1/payments/${paymentId}/receipt`).set(auth).expect(200);
      expect(receipt.body).toMatchObject({ payerName: 'Marta Mãe', teacherName: 'Prof Gestão' });
      expect(receipt.body.payment.receiptNumber).toMatch(/^\d{6}$/);

      // Com pagamento, não cancela nem apaga.
      await http.post(`/v1/charges/${c.id}/cancel`).set(auth).expect(400);
      await http.delete(`/v1/charges/${c.id}`).set(auth).expect(400);

      const refunded = await http.delete(`/v1/payments/${paymentId}`).set(auth).expect(200);
      expect(refunded.body).toMatchObject({ status: 'PENDENTE', balanceCents: 5000, payments: [] });
      await http.get(`/v1/payments/${paymentId}/receipt`).set(auth).expect(404);

      const canceled = await http.post(`/v1/charges/${c.id}/cancel`).set(auth).expect(200);
      expect(canceled.body.status).toBe('CANCELADO');
      await pay(c.id, 100).expect(400);
      await http.patch(`/v1/charges/${c.id}`).set(auth).send({ amountCents: 1 }).expect(400);

      const reopened = await http.post(`/v1/charges/${c.id}/reopen`).set(auth).expect(200);
      expect(reopened.body.status).toBe('PENDENTE');

      await http.delete(`/v1/charges/${c.id}`).set(auth).expect(204);
      await http.get(`/v1/charges/${c.id}`).set(auth).expect(404);
    });

    it('cobranças automáticas (mensalidade) são canceladas, não apagadas', async () => {
      const kid = await newStudent('Rui Mensal', { type: 'MENSAL', monthlyFeeCents: 20000, dueDay: 10 }, { startDate: today });
      const list = (await http.get(`/v1/charges?studentId=${kid.id}`).set(auth).expect(200)).body as { id: string; kind: string }[];
      const monthly = list.find((c) => c.kind === 'MENSALIDADE')!;
      await http.delete(`/v1/charges/${monthly.id}`).set(auth).expect(400);
      await http.post(`/v1/charges/${monthly.id}/cancel`).set(auth).expect(200);
    });

    it('resumo do mês e destaques da tela Hoje', async () => {
      const summary = async () => (await http.get(`/v1/finance/summary?month=${month}`).set(auth).expect(200)).body;
      const before = await summary();

      const thisMonth = await charge({ amountCents: 7000, dueDate: today });
      await pay(thisMonth.id, 3000).expect(201);
      const late = await charge({ amountCents: 2500, dueDate: addDays(today, -3) });
      const soon = await charge({ amountCents: 1500, dueDate: addDays(today, 3) });

      const after = await summary();
      expect(after.receivedCents - before.receivedCents).toBe(3000);
      expect(after.overdueCents - before.overdueCents).toBe(2500);
      expect(after.overdueCount - before.overdueCount).toBe(1);
      const inMonth = (d: string) => monthOf(d) === month;
      const expectedDelta = 7000 + (inMonth(addDays(today, -3)) ? 2500 : 0) + (inMonth(addDays(today, 3)) ? 1500 : 0);
      expect(after.expectedCents - before.expectedCents).toBe(expectedDelta);
      expect(after.openCents - before.openCents).toBe(expectedDelta - 3000);

      const hl = (await http.get('/v1/finance/highlights').set(auth).expect(200)).body as {
        dueSoon: { id: string }[];
        overdue: { id: string }[];
      };
      expect(hl.dueSoon.map((c) => c.id)).toEqual(expect.arrayContaining([soon.id, thisMonth.id]));
      expect(hl.overdue.map((c) => c.id)).toContain(late.id);
      expect(hl.dueSoon.map((c) => c.id)).not.toContain(late.id);

      // Filtros da lista do financeiro.
      const list = async (status: string) =>
        ((await http.get(`/v1/charges?status=${status}&month=${month}`).set(auth).expect(200)).body as { id: string }[]).map((c) => c.id);
      expect(await list('atrasadas')).toContain(late.id);
      expect(await list('abertas')).toContain(thisMonth.id);
      await pay(soon.id, 1500).expect(201);
      if (inMonth(addDays(today, 3))) expect(await list('pagas')).toContain(soon.id);
    });

    it('prévia do fechamento soma as aulas por aula ainda não cobradas no mês', async () => {
      const ze = await newStudent('Zé Prévia', porAula(9000));
      const empty = await http.get(`/v1/students/${ze.id}/billing-preview`).set(auth).expect(200);
      expect(empty.body).toMatchObject({ month, lessonsCount: 0, amountCents: 0 });
      // Duas aulas de hoje cedo (sempre no mês corrente): uma realizada, outra falta não justificada (cobrada).
      const base = new Date(`${today}T00:00:00-03:00`).getTime();
      const a = await newLesson(ze.id, new Date(base + 60 * 60_000));
      const b = await newLesson(ze.id, new Date(base + 3 * 60 * 60_000));
      const c = await newLesson(ze.id, new Date(base + 5 * 60 * 60_000));
      await mark(a.id, { status: 'REALIZADA' });
      await mark(b.id, { status: 'FALTA_ALUNO' });
      await mark(c.id, { status: 'FALTA_PROFESSOR' });
      const preview = await http.get(`/v1/students/${ze.id}/billing-preview`).set(auth).expect(200);
      expect(preview.body).toMatchObject({ month, lessonsCount: 2, amountCents: 18000 });
    });
  });

  describe('alunos', () => {
    it('editar: dados, etiquetas e busca; sem responsável não há "responsável paga"', async () => {
      const s = await newStudent('Nina Edita', porAula());
      const res = await http
        .patch(`/v1/students/${s.id}`)
        .set(auth)
        .send({ name: 'Nina Editada', nickname: 'Nini', tags: ['violão', 'manhã'], payerIsGuardian: true, notes: 'Gosta de MPB' })
        .expect(200);
      expect(res.body).toMatchObject({ name: 'Nina Editada', nickname: 'Nini', tags: ['violão', 'manhã'], payerIsGuardian: false, notes: 'Gosta de MPB' });
      const found = (await http.get('/v1/students?q=violao').set(auth).expect(200)).body as { id: string }[];
      expect(found.map((x) => x.id)).toContain(s.id);
      await http.patch(`/v1/students/${s.id}`).set(auth).send({ phone: '123' }).expect(400);
    });

    it('excluir apaga o aluno e o que é dele', async () => {
      const s = await newStudent('Otto Sai', porAula());
      await newLesson(s.id, daysAgo(1));
      await http.delete(`/v1/students/${s.id}`).set(auth).expect(204);
      await http.get(`/v1/students/${s.id}`).set(auth).expect(404);
      const [{ n }] = await app.get(DataSource).query('SELECT count(*)::int AS n FROM lessons WHERE student_id = $1', [s.id]);
      expect(n).toBe(0);
    });

    it('reajuste: novo preço vale a partir da data; dá para desfazer só o mais recente', async () => {
      const s = await newStudent('Pedro Reajuste', porAula(10000));
      const from = addDays(today, -10);
      await http.post(`/v1/students/${s.id}/plans`).set(auth).send({ ...porAula(12000), validFrom: addDays(today, -95) }).expect(400);
      const res = await http.post(`/v1/students/${s.id}/plans`).set(auth).send({ ...porAula(12000), validFrom: from }).expect(201);
      expect(res.body.currentPlan.lessonPriceCents).toBe(12000);
      expect(res.body.plans).toHaveLength(2);
      expect(res.body.plans[1].validTo).toBe(addDays(from, -1));

      const before = await newLesson(s.id, daysAgo(20));
      const after = await newLesson(s.id, daysAgo(5));
      expect((await mark(before.id, { status: 'REALIZADA' })).body.priceCents).toBe(10000);
      expect((await mark(after.id, { status: 'REALIZADA' })).body.priceCents).toBe(12000);

      const [latest, first] = res.body.plans as { id: string }[];
      await http.delete(`/v1/students/${s.id}/plans/${first.id}`).set(auth).expect(400);
      const undone = await http.delete(`/v1/students/${s.id}/plans/${latest.id}`).set(auth).expect(200);
      expect(undone.body.plans).toHaveLength(1);
      expect(undone.body.plans[0].validTo).toBeNull();
      expect(undone.body.currentPlan.lessonPriceCents).toBe(10000);
      await http.delete(`/v1/students/${s.id}/plans/${first.id}`).set(auth).expect(400);
    });

    it('pausa: some com as aulas do período e volta sozinha quando a data passa', async () => {
      const s = await newStudent('Quel Pausa', porAula());
      await http
        .post(`/v1/students/${s.id}/slots`)
        .set(auth)
        .send({ weekday: weekdayOf(addDays(today, 1)), startTime: '09:00', durationMin: 60, mode: 'PRESENCIAL' })
        .expect(201);
      const all = await lessons(s.id);
      const until = addDays(today, 15);
      await http.post(`/v1/students/${s.id}/status`).set(auth).send({ status: 'PAUSADO', pausedUntil: addDays(today, -1) }).expect(400);
      const paused = await http.post(`/v1/students/${s.id}/status`).set(auth).send({ status: 'PAUSADO', pausedUntil: until }).expect(200);
      expect(paused.body).toMatchObject({ status: 'PAUSADO', pausedUntil: until });

      const during = await lessons(s.id);
      expect(during.every((l) => localDate(l.startsAt) > until)).toBe(true);
      expect(during.length).toBeLessThan(all.length);

      // O tempo passa: a data de volta fica para trás e o cron de hora em hora reativa.
      await app.get(DataSource).query('UPDATE students SET paused_until = $2 WHERE id = $1', [s.id, addDays(today, -1)]);
      await app.get(StudentsService).resumeExpiredPauses();
      const back = (await http.get(`/v1/students/${s.id}`).set(auth).expect(200)).body;
      expect(back).toMatchObject({ status: 'ATIVO', pausedUntil: null });
      expect((await lessons(s.id)).length).toBe(all.length);
    });
  });

  describe('agenda', () => {
    it('horário fixo: muda "desta em diante" sem mexer nas aulas já marcadas, e encerra', async () => {
      const s = await newStudent('Rita Horário', porAula());
      const weekday = weekdayOf(addDays(today, 1));
      const slot = (
        await http.post(`/v1/students/${s.id}/slots`).set(auth).send({ weekday, startTime: '10:00', durationMin: 60, mode: 'PRESENCIAL' }).expect(201)
      ).body as { id: string };
      await http.post(`/v1/students/${s.id}/slots`).set(auth).send({ weekday, startTime: '10:00', durationMin: 60, mode: 'ONLINE' }).expect(400);

      const from = addDays(today, 15);
      const firstAfter = (await lessons(s.id)).find((l) => localDate(l.startsAt) >= from)!;
      await mark(firstAfter.id, { status: 'REALIZADA' });

      const updated = await http
        .patch(`/v1/slots/${slot.id}`)
        .set(auth)
        .send({ weekday, startTime: '11:00', durationMin: 45, mode: 'ONLINE', meetingUrl: 'https://meet.google.com/abc-defg-hij', effectiveFrom: from })
        .expect(200);
      expect(updated.body).toMatchObject({ startTime: '11:00', durationMin: 45, mode: 'ONLINE', validFrom: from });

      const list = await lessons(s.id);
      const scheduled = list.filter((l) => l.status === 'AGENDADA');
      expect(scheduled.filter((l) => localDate(l.startsAt) < from).every((l) => localTime(l.startsAt) === '10:00')).toBe(true);
      expect(scheduled.filter((l) => localDate(l.startsAt) >= from).every((l) => localTime(l.startsAt) === '11:00')).toBe(true);
      expect(list.find((l) => l.id === firstAfter.id)).toMatchObject({ status: 'REALIZADA' });

      const slots = (await http.get(`/v1/students/${s.id}/slots`).set(auth).expect(200)).body as { id: string; validTo: string | null }[];
      expect(slots).toHaveLength(2);
      expect(slots.find((x) => x.id === slot.id)?.validTo).toBe(addDays(from, -1));

      // Encerrar o novo horário a partir de 4 semanas: nada agendado depois disso.
      const end = addDays(today, 29);
      await http.delete(`/v1/slots/${updated.body.id}?from=${end}`).set(auth).expect(204);
      const remaining = (await lessons(s.id)).filter((l) => l.status === 'AGENDADA');
      expect(remaining.every((l) => localDate(l.startsAt) < end)).toBe(true);

      // Encerrar o antigo desde o início: sem aulas marcadas nele, o horário some.
      await http.delete(`/v1/slots/${slot.id}?from=${today}`).set(auth).expect(204);
      const left = (await http.get(`/v1/students/${s.id}/slots`).set(auth).expect(200)).body as { id: string }[];
      expect(left.map((x) => x.id)).toEqual([updated.body.id]);
    });

    it('aula avulsa: edita conteúdo e duração, apaga se não marcada; aula de horário fixo não se apaga', async () => {
      const s = await newStudent('Sofia Avulsa', porAula());
      const l = await newLesson(s.id, new Date(Date.now() + 3 * 86_400_000));
      const edited = await http
        .patch(`/v1/lessons/${l.id}`)
        .set(auth)
        .send({ durationMin: 90, content: 'Escalas maiores', homework: 'Estudar 15 min por dia', location: 'Estúdio 2' })
        .expect(200);
      expect(edited.body).toMatchObject({ durationMin: 90, content: 'Escalas maiores', homework: 'Estudar 15 min por dia', location: 'Estúdio 2' });
      await http.patch(`/v1/lessons/${l.id}`).set(auth).send({ durationMin: 5 }).expect(400);

      const marked = await newLesson(s.id, daysAgo(1));
      await mark(marked.id, { status: 'REALIZADA' });
      await http.delete(`/v1/lessons/${marked.id}`).set(auth).expect(400);

      await http.post(`/v1/students/${s.id}/slots`).set(auth).send({ weekday: 3, startTime: '15:00', durationMin: 60, mode: 'PRESENCIAL' }).expect(201);
      const fixed = (await lessons(s.id)).find((x) => x.slotId)!;
      await http.delete(`/v1/lessons/${fixed.id}`).set(auth).expect(400);

      await http.delete(`/v1/lessons/${l.id}`).set(auth).expect(204);
      await http.get(`/v1/lessons/${l.id}`).set(auth).expect(404);
    });

    it('aulas pendentes: as que já passaram sem marcação', async () => {
      const s = await newStudent('Tati Pendente', porAula());
      const forgotten = await newLesson(s.id, daysAgo(2));
      const done = await newLesson(s.id, daysAgo(3));
      await mark(done.id, { status: 'REALIZADA' });
      const future = await newLesson(s.id, new Date(Date.now() + 86_400_000));
      const ids = ((await http.get('/v1/lessons/pending').set(auth).expect(200)).body as { id: string }[]).map((x) => x.id);
      expect(ids).toContain(forgotten.id);
      expect(ids).not.toContain(done.id);
      expect(ids).not.toContain(future.id);
    });

    it('reposição: cancelar o crédito manualmente; apagar a aula de reposição devolve o crédito', async () => {
      const s = await newStudent('Ugo Reposição', porAula());
      const credits = async () =>
        (await http.get(`/v1/makeup-credits?studentId=${s.id}`).set(auth).expect(200)).body as { id: string; status: string; originLessonId: string }[];
      const a = await newLesson(s.id, daysAgo(4));
      const b = await newLesson(s.id, daysAgo(3));
      await mark(a.id, { status: 'FALTA_PROFESSOR' });
      await mark(b.id, { status: 'FALTA_PROFESSOR' });
      const [ca, cb] = [(await credits()).find((c) => c.originLessonId === a.id)!, (await credits()).find((c) => c.originLessonId === b.id)!];

      await http.delete(`/v1/makeup-credits/${ca.id}`).set(auth).expect(204);
      expect((await credits()).find((c) => c.id === ca.id)?.status).toBe('CANCELADO');
      await http.delete(`/v1/makeup-credits/${ca.id}`).set(auth).expect(400);
      const open = (await http.get(`/v1/makeup-credits?studentId=${s.id}&status=ABERTO`).set(auth).expect(200)).body as { id: string }[];
      expect(open.map((c) => c.id)).toEqual([cb.id]);

      const makeup = await newLesson(s.id, new Date(Date.now() + 2 * 86_400_000), { makeupCreditId: cb.id });
      await http.delete(`/v1/makeup-credits/${cb.id}`).set(auth).expect(400);
      await http.delete(`/v1/lessons/${makeup.id}`).set(auth).expect(204);
      expect((await credits()).find((c) => c.id === cb.id)?.status).toBe('ABERTO');
    });
  });

  describe('detalhes', () => {
    /** Hoje cedo (sempre no mês corrente, no fuso do professor). */
    const todayAt = (hour: number) => new Date(new Date(`${today}T00:00:00-03:00`).getTime() + hour * 60 * 60_000);

    it('fechar o mês já pago: aulas novas viram cobrança de "aulas adicionais"', async () => {
      const s = await newStudent('Vini Ajuste', porAula(6000));
      await http.post('/v1/charges/close-month').set(auth).send({ studentId: s.id, month }).expect(400);
      await mark((await newLesson(s.id, todayAt(1))).id, { status: 'REALIZADA' });
      await http.post('/v1/charges/close-month').set(auth).send({ studentId: s.id, month }).expect(201);
      const [first] = (await http.get(`/v1/charges?studentId=${s.id}`).set(auth).expect(200)).body as { id: string; kind: string; amountCents: number }[];
      expect(first).toMatchObject({ kind: 'AULAS_DO_MES', amountCents: 6000 });
      await http.post(`/v1/charges/${first.id}/payments`).set(auth).send({ amountCents: 6000, paidAt: today, method: 'PIX' }).expect(201);

      await mark((await newLesson(s.id, todayAt(2))).id, { status: 'REALIZADA' });
      const closed = await http.post('/v1/charges/close-month').set(auth).send({ studentId: s.id, month }).expect(201);
      expect(closed.body.created).toBe(1);
      const all = (await http.get(`/v1/charges?studentId=${s.id}`).set(auth).expect(200)).body as { kind: string; amountCents: number; description: string }[];
      const extra = all.find((c) => c.kind === 'AJUSTE')!;
      expect(extra).toMatchObject({ amountCents: 6000 });
      expect(extra.description).toMatch(/^Aulas adicionais de /);
    });

    it('relatórios filtram por tipo de plano e exportam cobranças e atrasos', async () => {
      const mensal = await newStudent('Xavi Mensal', { type: 'MENSAL', monthlyFeeCents: 15000, dueDay: 10 }, { startDate: today });
      await http.get(`/v1/charges?studentId=${mensal.id}`).set(auth).expect(200); // gera a mensalidade
      const q = `from=${addDays(today, -40)}&to=${addDays(today, 40)}`;
      const onlyMensal = (await http.get(`/v1/reports/summary?${q}&planTypes=MENSAL`).set(auth).expect(200)).body as {
        byStudent: { student: { name: string } }[];
      };
      const names = onlyMensal.byStudent.map((r) => r.student.name);
      expect(names).toContain('Xavi Mensal');
      expect(names).not.toContain('Vini Ajuste');

      const cobrancas = await http.get(`/v1/reports/export.csv?type=cobrancas&${q}`).set(auth).expect(200);
      expect(cobrancas.headers['content-disposition']).toContain('turmei-cobrancas-');
      expect(cobrancas.text).toContain('Vencimento;Aluno;Descrição');
      expect(cobrancas.text).toContain('Xavi Mensal');
      const atrasos = await http.get(`/v1/reports/export.csv?type=atrasos&${q}`).set(auth).expect(200);
      expect(atrasos.text).toContain('Aluno;Cobranças vencidas');
      await http.get(`/v1/reports/export.csv?type=senhas&${q}`).set(auth).expect(400);
    });

    it('lista os bloqueios da agenda', async () => {
      const created = await http
        .post('/v1/schedule-blocks')
        .set(auth)
        .send({ startDate: addDays(today, 100), endDate: addDays(today, 101), reason: 'Congresso' })
        .expect(201);
      const list = (await http.get('/v1/schedule-blocks').set(auth).expect(200)).body as { id: string; reason: string }[];
      expect(list).toContainEqual(expect.objectContaining({ id: created.body.block.id, reason: 'Congresso' }));
    });

    it('rotinas: o cron de lembretes roda para todos sem erro e a auditoria apaga o que passou de 1 ano', async () => {
      await expect(app.get(RemindersService).tick(new Date('2031-06-01T15:00:00Z'))).resolves.toBeUndefined();
      const db = app.get(DataSource);
      await db.query(`INSERT INTO security_events (type, created_at) VALUES ('LOGIN_OK', now() - interval '400 days'), ('LOGIN_OK', now())`);
      const count = async () => (await db.query(`SELECT count(*)::int AS n FROM security_events WHERE type = 'LOGIN_OK' AND teacher_id IS NULL`))[0].n;
      expect(await count()).toBe(2);
      await app.get(SecurityEventsService).prune();
      expect(await count()).toBe(1);
    });
  });

  describe('telefones', () => {
    const plan = { type: 'POR_AULA', lessonPriceCents: 8000, dueDay: 10 };
    const create = (phone: string, extra: Record<string, unknown> = {}) =>
      http.post('/v1/students').set(auth).send({ name: 'Aluno Telefone', phone, plan, ...extra });

    it('aceita número de outro país (guarda E.164) e mantém o Brasil só com dígitos', async () => {
      const us = await create('+1 (415) 555-2671').expect(201);
      expect(us.body.phone).toBe('+14155552671');
      const uk = await create('00 44 7911 123456').expect(201);
      expect(uk.body.phone).toBe('+447911123456');
      const br = await create('(11) 98765-4321').expect(201);
      expect(br.body.phone).toBe('11987654321');
      // +55 completo é Brasil: perde o "+55".
      const brIntl = await create('+55 (11) 98765-4321').expect(201);
      expect(brIntl.body.phone).toBe('11987654321');
    });

    it('recusa número curto, longo demais ou malformado', async () => {
      // (Sem "+", um número como 4155552671 é lido como fixo de Curitiba — por isso o app pede o "+".)
      for (const phone of ['+1415', '+0123456789', '+1234567890123456', '+55 11 999', '123', 'abc']) {
        const res = await create(phone).expect(400);
        expect(JSON.stringify(res.body)).toContain('Telefone inválido');
      }
    });

    it('responsável e professor também aceitam número internacional', async () => {
      const s = await create('11987654321', { guardianName: 'Mr. Smith', guardianPhone: '+44 7911 123456', payerIsGuardian: true }).expect(201);
      expect(s.body.guardianPhone).toBe('+447911123456');
      const edited = await http.patch(`/v1/students/${s.body.id}`).set(auth).send({ phone: '+351 912 345 678' }).expect(200);
      expect(edited.body.phone).toBe('+351912345678');
      const prof = await http.patch('/v1/me/profile').set(auth).send({ name: 'Prof Gestão', cpf: '529.982.247-25', phone: '+1 415 555 2671' }).expect(200);
      expect(prof.body.phone).toBe('+14155552671');
    });

    it('WhatsApp da cobrança usa o DDI do aluno (sem forçar 55)', async () => {
      const s = await create('+1 415 555 2671', { name: 'Zap Internacional' }).expect(201);
      const ch = await http
        .post('/v1/charges')
        .set(auth)
        .send({ studentId: s.body.id, description: 'Aula online', amountCents: 8000, dueDate: addDays(today, 3) })
        .expect(201);
      const msg = await http.get(`/v1/charges/${ch.body.id}/whatsapp`).set(auth).expect(200);
      expect(msg.body.phone).toBe('+14155552671');
      expect(msg.body.url).toMatch(/^https:\/\/wa\.me\/14155552671\?text=/);
    });
  });
});
