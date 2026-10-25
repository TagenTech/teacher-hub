/**
 * Fluxo ponta a ponta contra um Postgres real (banco gestao_aulas_test):
 * login → aluno → horário fixo → presença → reposição → cobrança → pagamento → relatórios.
 *   pnpm --filter @turmei/api test:e2e
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { addDays, monthOf, todayIn, weekdayOf } from '@turmei/contracts';
import { currentStep, hotp } from '../src/auth/totp';
import { Student } from '../src/alunos/entities/student.entity';
import { Teacher } from '../src/professor/entities/teacher.entity';
import { TeachersService } from '../src/professor/teachers.service';
import { createTestApp, quotedTable } from './helpers';

describe('Turmei (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let token = '';
  let recoveryCodes: string[] = [];
  const today = todayIn();
  const auth = () => ({ authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(TeachersService).upsert('Prof Teste', 'e2e@turmei.test', 'senha-e2e-123');
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
  });

  it('bloqueia rotas sem login', async () => {
    await http.get('/v1/students').expect(401);
  });

  it('faz login e devolve cookie httpOnly', async () => {
    const res = await http.post('/v1/auth/login').send({ email: 'e2e@turmei.test', password: 'senha-e2e-123' }).expect(200);
    token = res.body.accessToken;
    expect(res.headers['set-cookie'][0]).toMatch(/turmei_refresh=.*HttpOnly/);
  });

  let studentId = '';
  it('cadastra aluno com plano por aula', async () => {
    const res = await http
      .post('/v1/students')
      .set(auth())
      .send({ name: 'Aluno E2E', phone: '(11) 98765-4321', plan: { type: 'POR_AULA', lessonPriceCents: 10000, dueDay: 10 } })
      .expect(201);
    studentId = res.body.id;
    expect(res.body.phone).toBe('11987654321');
    expect(res.body.currentPlan.lessonPriceCents).toBe(10000);
  });

  let lessonId = '';
  it('horário fixo gera as aulas das próximas semanas', async () => {
    await http
      .post(`/v1/students/${studentId}/slots`)
      .set(auth())
      .send({ weekday: weekdayOf(today), startTime: '23:30', durationMin: 60, mode: 'PRESENCIAL' })
      .expect(201);
    const res = await http.get(`/v1/lessons?from=${today}&to=${addDays(today, 56)}&studentId=${studentId}`).set(auth()).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(8);
    lessonId = res.body[0].id;
  });

  it('presença: realizada guarda o preço; falta do professor gera reposição', async () => {
    const done = await http.post(`/v1/lessons/${lessonId}/attendance`).set(auth()).send({ status: 'REALIZADA' }).expect(200);
    expect(done.body.priceCents).toBe(10000);
    const missed = await http.post(`/v1/lessons/${lessonId}/attendance`).set(auth()).send({ status: 'FALTA_PROFESSOR' }).expect(200);
    expect(missed.body.chargeable).toBe(false);
    const credits = await http.get(`/v1/makeup-credits?studentId=${studentId}&status=ABERTO`).set(auth()).expect(200);
    expect(credits.body).toHaveLength(1);
    await http.post(`/v1/lessons/${lessonId}/attendance`).set(auth()).send({ status: 'REALIZADA' }).expect(200);
  });

  let chargeId = '';
  it('fecha o mês e registra pagamento parcial e total', async () => {
    await http.post('/v1/charges/close-month').set(auth()).send({ studentId, month: monthOf(today) }).expect(201);
    const list = await http.get(`/v1/charges?studentId=${studentId}`).set(auth()).expect(200);
    chargeId = list.body[0].id;
    expect(list.body[0].amountCents).toBe(10000);
    const partial = await http.post(`/v1/charges/${chargeId}/payments`).set(auth()).send({ amountCents: 4000, paidAt: today, method: 'PIX' }).expect(201);
    expect(partial.body.balanceCents).toBe(6000);
    await http.post(`/v1/charges/${chargeId}/payments`).set(auth()).send({ amountCents: 9000, paidAt: today, method: 'PIX' }).expect(400);
    const paid = await http.post(`/v1/charges/${chargeId}/payments`).set(auth()).send({ amountCents: 6000, paidAt: today, method: 'DINHEIRO' }).expect(201);
    expect(paid.body.status).toBe('PAGO');
  });

  it('mensagem de WhatsApp pronta', async () => {
    const res = await http.get(`/v1/charges/${chargeId}/whatsapp`).set(auth()).expect(200);
    expect(res.body.url).toContain('wa.me/5511987654321');
  });

  it('relatórios refletem o pagamento', async () => {
    const q = `from=${addDays(today, -31)}&to=${addDays(today, 31)}`;
    const summary = await http.get(`/v1/reports/summary?${q}`).set(auth()).expect(200);
    expect(summary.body.receivedCents).toBe(10000);
    expect(summary.body.lessons.realized).toBe(1);
    const csv = await http.get(`/v1/reports/export.csv?type=pagamentos&${q}`).set(auth()).expect(200);
    expect(csv.text.split('\r\n').filter(Boolean)).toHaveLength(3);
  });

  it('feed .ics público só com o token certo', async () => {
    const feed = await http.get('/v1/calendar/feed').set(auth()).expect(200);
    const token = feed.body.url.split('/').pop();
    const ics = await http.get(`/v1/calendar/${token}`).expect(200);
    expect(ics.text).toContain('BEGIN:VCALENDAR');
    expect(ics.text).toContain('BEGIN:VALARM');
    await http.get('/v1/calendar/token-errado.ics').expect(404);
  });

  it('cadastro público: entra logado, confirma e-mail pelo link e finaliza o cadastro com CPF', async () => {
    const providers = await http.get('/v1/auth/providers').expect(200);
    expect(providers.body).toEqual({ providers: [], signupEnabled: true });

    await http.post('/v1/auth/register').send({ name: 'Nova', email: 'nova@turmei.test', password: '123', acceptTerms: false }).expect(400);
    const reg = await http
      .post('/v1/auth/register')
      .send({ name: 'Nova Pessoa', email: 'nova@turmei.test', password: 'senha-nova-123', acceptTerms: true })
      .expect(201);
    expect(reg.body.teacher).toMatchObject({ emailVerified: false, profileComplete: false, hasPassword: true });
    await http.post('/v1/auth/register').send({ name: 'X', email: 'NOVA@turmei.test', password: 'senha-nova-123', acceptTerms: true }).expect(400);

    const outbox = await http.get('/v1/dev/outbox').expect(200);
    const link: string = outbox.body.find((m: { subject: string }) => m.subject.startsWith('Confirme')).link;
    await http.post('/v1/auth/verify-email').send({ token: link.split('token=')[1] }).expect(204);

    const novaAuth = { authorization: `Bearer ${reg.body.accessToken}` };
    await http.patch('/v1/me/profile').set(novaAuth).send({ name: 'Nova Pessoa', cpf: '111.111.111-11', phone: '11987654321' }).expect(400);
    const prof = await http
      .patch('/v1/me/profile')
      .set(novaAuth)
      .send({ name: 'Nova Pessoa Silva', cpf: '529.982.247-25', phone: '(11) 98765-4321', state: 'SP' })
      .expect(200);
    expect(prof.body).toMatchObject({ emailVerified: true, profileComplete: true, cpfMasked: '***.982.247-**' });
    expect(JSON.stringify(prof.body)).not.toContain('52998224725');
    // No banco: só cifra + índice cego, nunca o número.
    const db = app.get(DataSource);
    const [row] = await db.query(`SELECT * FROM ${quotedTable(db, Teacher)} WHERE email = 'nova@turmei.test'`);
    expect(JSON.stringify(row)).not.toContain('52998224725');
    expect(row.cpf_encrypted).toMatch(/^v1:/);
  });

  it('2FA: ativa, exige código no login, aceita recuperação uma vez e derruba sessões antigas', async () => {
    const login = () => http.post('/v1/auth/login').send({ email: 'e2e@turmei.test', password: 'senha-e2e-123' });
    const first = await login().expect(200);
    const tokenA = first.body.accessToken as string;
    const authA = { authorization: `Bearer ${tokenA}` };

    const setup = await http.post('/v1/auth/mfa/setup').set(authA).expect(200);
    expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    await http.post('/v1/auth/mfa/enable').set(authA).send({ code: '000000' }).expect(400);
    const enabled = await http
      .post('/v1/auth/mfa/enable')
      .set(authA)
      .send({ code: hotp(setup.body.secret, currentStep()) })
      .expect(200);
    expect(enabled.body.codes).toHaveLength(10);
    recoveryCodes = enabled.body.codes;

    // Login agora pede o segundo fator.
    const challenge = await login().expect(200);
    expect(challenge.body).toMatchObject({ mfaRequired: true });
    expect(challenge.body.accessToken).toBeUndefined();
    // O token de 2FA não serve como login.
    await http.get('/v1/students').set({ authorization: `Bearer ${challenge.body.mfaToken}` }).expect(401);
    await http.post('/v1/auth/mfa/verify').send({ mfaToken: challenge.body.mfaToken, code: '123456' }).expect(401);
    const recovery = enabled.body.codes[0];
    const ok = await http.post('/v1/auth/mfa/verify').send({ mfaToken: challenge.body.mfaToken, code: recovery }).expect(200);
    const authB = { authorization: `Bearer ${ok.body.accessToken}` };
    // Ticket de uso único e código de recuperação de uso único.
    await http.post('/v1/auth/mfa/verify').send({ mfaToken: challenge.body.mfaToken, code: recovery }).expect(401);

    const sessions = await http.get('/v1/auth/sessions').set(authB).expect(200);
    expect(sessions.body.length).toBeGreaterThanOrEqual(2);
    expect(sessions.body.filter((x: { current: boolean }) => x.current)).toHaveLength(1);

    // "Sair dos outros aparelhos": o token A deixa de valer na hora.
    await http.post('/v1/auth/sessions/revoke-others').set(authB).expect(204);
    await http.get('/v1/students').set(authA).expect(401);
    await http.get('/v1/students').set(authB).expect(200);

    const activity = await http.get('/v1/auth/activity').set(authB).expect(200);
    const types = activity.body.map((e: { type: string }) => e.type);
    expect(types).toEqual(expect.arrayContaining(['MFA_ENABLED', 'RECOVERY_CODE_USED', 'SESSION_REVOKED', 'MFA_FAIL']));

    token = ok.body.accessToken;
  });

  it('trocar a senha invalida o access token na hora', async () => {
    const before = { authorization: `Bearer ${token}` };
    await new Promise((r) => setTimeout(r, 1100));
    await http.patch('/v1/auth/password').set(before).send({ currentPassword: 'senha-e2e-123', newPassword: 'senha-e2e-456' }).expect(204);
    await http.get('/v1/students').set(before).expect(401);
    // Entra de novo com a senha nova + 2FA (código de recuperação ainda não usado).
    const challenge = await http.post('/v1/auth/login').send({ email: 'e2e@turmei.test', password: 'senha-e2e-456' }).expect(200);
    const ok = await http.post('/v1/auth/mfa/verify').send({ mfaToken: challenge.body.mfaToken, code: recoveryCodes[1] }).expect(200);
    token = ok.body.accessToken;
  });

  it('segurança: recusa endereço de push interno (SSRF) e neutraliza fórmula no CSV', async () => {
    for (const endpoint of ['https://169.254.169.254/latest/meta-data', 'http://localhost:3200/v1/health', 'https://fcm.googleapis.com.evil.com/x']) {
      await http.post('/v1/push/subscribe').set(auth()).send({ endpoint, keys: { p256dh: 'x', auth: 'y' } }).expect(400);
    }
    await http
      .post('/v1/push/subscribe')
      .set(auth())
      .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'x', auth: 'y' } })
      .expect(204);

    const evil = await http
      .post('/v1/students')
      .set(auth())
      .send({ name: '=HYPERLINK("https://evil.com","clique")', plan: { type: 'MENSAL', monthlyFeeCents: 1000, dueDay: 10 } })
      .expect(201);
    const lesson = await http
      .post('/v1/lessons')
      .set(auth())
      .send({ studentId: evil.body.id, startsAt: new Date(Date.now() - 86_400_000).toISOString(), durationMin: 60, mode: 'PRESENCIAL' })
      .expect(201);
    await http.post(`/v1/lessons/${lesson.body.id}/attendance`).set(auth()).send({ status: 'REALIZADA' }).expect(200);
    const csv = await http.get(`/v1/reports/export.csv?type=aulas&from=${addDays(today, -3)}&to=${today}`).set(auth()).expect(200);
    expect(csv.text).toContain(`'=HYPERLINK`);
    expect(csv.text).not.toMatch(/;=HYPERLINK/);
  });

  it('cabeçalhos de segurança na API', async () => {
    const res = await http.get('/v1/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('excluir a conta apaga todos os dados e invalida o token', async () => {
    const reg = await http
      .post('/v1/auth/register')
      .send({ name: 'Sai Daqui', email: 'sai@turmei.test', password: 'senha-sai-123', acceptTerms: true })
      .expect(201);
    const a = { authorization: `Bearer ${reg.body.accessToken}` };
    await http.post('/v1/students').set(a).send({ name: 'Aluno X', plan: { type: 'MENSAL', monthlyFeeCents: 1000, dueDay: 5 } }).expect(201);
    await http.post('/v1/auth/delete-account').set(a).send({ confirmEmail: 'outro@x.com', password: 'senha-sai-123' }).expect(400);
    await http.post('/v1/auth/delete-account').set(a).send({ confirmEmail: 'sai@turmei.test', password: 'errada' }).expect(401);
    await http.post('/v1/auth/delete-account').set(a).send({ confirmEmail: 'sai@turmei.test', password: 'senha-sai-123' }).expect(204);
    await http.get('/v1/students').set(a).expect(401);
    const db = app.get(DataSource);
    const teachers = quotedTable(db, Teacher);
    const students = quotedTable(db, Student);
    const [{ n }] = await db.query(`SELECT count(*)::int AS n FROM ${teachers} WHERE email = 'sai@turmei.test'`);
    expect(n).toBe(0);
    const [{ orphans }] = await db.query(
      `SELECT count(*)::int AS orphans FROM ${students} s WHERE NOT EXISTS (SELECT 1 FROM ${teachers} t WHERE t.id = s.teacher_id)`,
    );
    expect(orphans).toBe(0);
  });

  it('isola dados por professor', async () => {
    await app.get(TeachersService).upsert('Outro', 'outro@turmei.test', 'senha-outro-123');
    const res = await http.post('/v1/auth/login').send({ email: 'outro@turmei.test', password: 'senha-outro-123' }).expect(200);
    const other = { authorization: `Bearer ${res.body.accessToken}` };
    await http.get(`/v1/students/${studentId}`).set(other).expect(404);
    await http.get(`/v1/charges/${chargeId}`).set(other).expect(404);
    const list = await http.get('/v1/students').set(other).expect(200);
    expect(list.body).toHaveLength(0);
  });
});
