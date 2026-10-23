/**
 * Conta e preferências contra um Postgres real: esqueci a senha, reenviar confirmação, renovação de sessão
 * (com detecção de reuso), sair, encerrar um aparelho, desativar 2FA e gerar novos códigos, ajustes,
 * exportar dados, push (status/desativar/teste) e novo link do calendário.
 *   pnpm --filter @aulinha/api test:e2e
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { currentStep, hotp } from '../src/auth/totp';
import { createTestApp, registerTeacher } from './helpers';

describe('Conta (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let me: Awaited<ReturnType<typeof registerTeacher>>;

  const outbox = async (to: string, subject: string) =>
    ((await http.get('/v1/dev/outbox').expect(200)).body as { to: string; subject: string; link: string }[]).filter(
      (m) => m.to === to && m.subject.startsWith(subject),
    );
  const tokenOf = (link: string) => new URL(link).searchParams.get('token')!;
  const cookieOf = (res: request.Response) =>
    ((res.headers['set-cookie'] as unknown as string[]) ?? []).find((c) => c.startsWith('aulinha_refresh='))?.split(';')[0];
  const login = (email: string, password: string) => http.post('/v1/auth/login').send({ email, password });

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
    me = await registerTeacher(http, 'Prof Conta', 'conta@aulinha.test');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reenviar confirmação manda um novo link que confirma o e-mail', async () => {
    expect(await outbox(me.email, 'Confirme')).toHaveLength(1);
    await http.post('/v1/auth/resend-verification').set(me.auth).expect(204);
    const mails = await outbox(me.email, 'Confirme');
    expect(mails).toHaveLength(2);
    await http.post('/v1/auth/verify-email').send({ token: tokenOf(mails[0].link) }).expect(204);
    expect((await http.get('/v1/me').set(me.auth).expect(200)).body.emailVerified).toBe(true);
  });

  it('esqueci a senha: não revela contas, o link troca a senha uma vez e derruba as sessões', async () => {
    const victim = await registerTeacher(http, 'Esquecida', 'esquecida@aulinha.test', 'senha-antiga-123');
    await http.post('/v1/auth/forgot-password').send({ email: 'ninguem@aulinha.test' }).expect(204);
    expect(await outbox('ninguem@aulinha.test', 'Redefinir')).toHaveLength(0);

    await http.post('/v1/auth/forgot-password').send({ email: victim.email }).expect(204);
    const [mail] = await outbox(victim.email, 'Redefinir');
    const token = tokenOf(mail.link);
    await http.post('/v1/auth/reset-password').send({ token, password: '123' }).expect(400);
    await http.post('/v1/auth/reset-password').send({ token, password: 'senha-nova-456' }).expect(204);
    await http.post('/v1/auth/reset-password').send({ token, password: 'outra-senha-789' }).expect(400);

    // A sessão antiga cai na hora.
    await http.get('/v1/students').set(victim.auth).expect(401);
    await http.post('/v1/auth/refresh').set('Cookie', victim.cookie).expect(401);
    await login(victim.email, 'senha-antiga-123').expect(401);
    await login(victim.email, 'senha-nova-456').expect(200);
  });

  it('renovar sessão troca o cookie; reusar o cookie antigo derruba tudo (roubo de token)', async () => {
    const t = await registerTeacher(http, 'Renova', 'renova@aulinha.test');
    const renewed = await http.post('/v1/auth/refresh').set('Cookie', t.cookie).expect(200);
    const newCookie = cookieOf(renewed)!;
    expect(newCookie).toBeDefined();
    expect(newCookie).not.toBe(t.cookie);
    const newAuth = { authorization: `Bearer ${renewed.body.accessToken}` };
    await http.get('/v1/students').set(newAuth).expect(200);

    await http.post('/v1/auth/refresh').set('Cookie', t.cookie).expect(401);
    await http.post('/v1/auth/refresh').set('Cookie', newCookie).expect(401);
    await http.get('/v1/students').set(newAuth).expect(401);
  });

  it('sair encerra a sessão e apaga o cookie', async () => {
    const t = await registerTeacher(http, 'Sai', 'sai-sessao@aulinha.test');
    const res = await http.post('/v1/auth/logout').set('Cookie', t.cookie).expect(204);
    expect(cookieOf(res)).toBe('aulinha_refresh=');
    await http.post('/v1/auth/refresh').set('Cookie', t.cookie).expect(401);
    await http.get('/v1/students').set(t.auth).expect(401);
    // Sair sem sessão não quebra.
    await http.post('/v1/auth/logout').expect(204);
  });

  it('encerrar um aparelho específico derruba só ele', async () => {
    const phone = await registerTeacher(http, 'Dois Aparelhos', 'dois@aulinha.test');
    const laptop = await login(phone.email, phone.password).expect(200);
    const laptopAuth = { authorization: `Bearer ${laptop.body.accessToken}` };

    const sessions = (await http.get('/v1/auth/sessions').set(laptopAuth).expect(200)).body as { id: string; current: boolean }[];
    expect(sessions).toHaveLength(2);
    const other = sessions.find((s) => !s.current)!;
    await http.delete(`/v1/auth/sessions/${other.id}`).set(laptopAuth).expect(204);

    await http.get('/v1/students').set(phone.auth).expect(401);
    // O aparelho removido tentando renovar só ganha 401 — não é "roubo" e não derruba o notebook.
    await http.post('/v1/auth/refresh').set('Cookie', phone.cookie).expect(401);
    await http.get('/v1/students').set(laptopAuth).expect(200);
    expect((await http.get('/v1/auth/sessions').set(laptopAuth).expect(200)).body).toHaveLength(1);
  });

  it('2FA: gerar novos códigos invalida os antigos; desativar exige código válido', async () => {
    const setup = await http.post('/v1/auth/mfa/setup').set(me.auth).expect(200);
    const secret = setup.body.secret as string;
    const step = currentStep();
    const enabled = await http.post('/v1/auth/mfa/enable').set(me.auth).send({ code: hotp(secret, step - 1) }).expect(200);
    const oldCodes = enabled.body.codes as string[];

    await http.post('/v1/auth/mfa/recovery-codes').set(me.auth).send({ code: '000000' }).expect(400);
    const fresh = await http.post('/v1/auth/mfa/recovery-codes').set(me.auth).send({ code: hotp(secret, step) }).expect(200);
    const newCodes = fresh.body.codes as string[];
    expect(newCodes).toHaveLength(10);
    expect(newCodes).not.toEqual(expect.arrayContaining([oldCodes[0]]));

    // Código antigo não serve mais; o novo serve (e só uma vez).
    await http.post('/v1/auth/mfa/disable').set(me.auth).send({ code: oldCodes[0] }).expect(400);
    // O mesmo código TOTP não vale duas vezes.
    await http.post('/v1/auth/mfa/disable').set(me.auth).send({ code: hotp(secret, step) }).expect(400);
    await http.post('/v1/auth/mfa/disable').set(me.auth).send({ code: newCodes[0] }).expect(204);
    expect((await http.get('/v1/me').set(me.auth).expect(200)).body.mfaEnabled).toBe(false);

    const types = ((await http.get('/v1/auth/activity').set(me.auth).expect(200)).body as { type: string }[]).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['MFA_ENABLED', 'MFA_DISABLED']));
  });

  it('ajustes: valida limites, salva e a mensagem de WhatsApp usa o modelo e o PIX', async () => {
    await http.patch('/v1/me/settings').set(me.auth).send({ paymentReminderHour: 30 }).expect(400);
    await http.patch('/v1/me/settings').set(me.auth).send({ pixKeyType: 'BITCOIN' }).expect(400);
    const saved = await http
      .patch('/v1/me/settings')
      .set(me.auth)
      .send({
        name: 'Prof Conta Silva',
        pixKey: 'conta@aulinha.test',
        pixKeyType: 'EMAIL',
        lessonReminderMinutes: 45,
        paymentReminderHour: 8,
        defaultLessonMinutes: 50,
        whatsappTemplate: 'Olá {nome}! {descricao}: {valor}.{pix} — {professor}',
      })
      .expect(200);
    expect(saved.body).toMatchObject({ name: 'Prof Conta Silva', pixKeyType: 'EMAIL', lessonReminderMinutes: 45, paymentReminderHour: 8, defaultLessonMinutes: 50 });
    expect((await http.get('/v1/me').set(me.auth).expect(200)).body.pixKey).toBe('conta@aulinha.test');

    const st = await http
      .post('/v1/students')
      .set(me.auth)
      .send({ name: 'Vera Zap', phone: '11987654321', plan: { type: 'POR_AULA', lessonPriceCents: 1000, dueDay: 5 } })
      .expect(201);
    const ch = await http
      .post('/v1/charges')
      .set(me.auth)
      .send({ studentId: st.body.id, description: 'Livro', amountCents: 4590, dueDate: '2030-01-10' })
      .expect(201);
    const msg = await http.get(`/v1/charges/${ch.body.id}/whatsapp`).set(me.auth).expect(200);
    expect(msg.body.text.replace(/\u00a0/g, ' ')).toBe('Olá Vera! livro: R$ 45,90.\nPIX (e-mail): conta@aulinha.test — Prof');
  });

  it('exportar meus dados traz tudo da conta, sem senha nem segredos', async () => {
    const res = await http.get('/v1/me/export').set(me.auth).expect(200);
    expect(res.body.teacher).toMatchObject({ email: me.email });
    expect(res.body.students.map((s: { name: string }) => s.name)).toContain('Vera Zap');
    expect(res.body.charges.length).toBeGreaterThan(0);
    const text = JSON.stringify(res.body);
    for (const secret of ['password_hash', 'mfa_secret', 'cpf_encrypted', 'ics_token', 'token_hash']) expect(text).not.toContain(secret);
  });

  it('push: aparelho aparece no status, recebe o teste e sai ao desativar', async () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/aparelho-1';
    const status = async () => (await http.get('/v1/push/status').set(me.auth).expect(200)).body as { enabled: boolean; devices: { deviceLabel: string }[] };
    expect((await status()).devices).toHaveLength(0);
    await http
      .post('/v1/push/subscribe')
      .set(me.auth)
      .send({ endpoint, keys: { p256dh: 'p', auth: 'a' }, deviceLabel: 'Android · Chrome' })
      .expect(204);
    expect((await status()).devices.map((d) => d.deviceLabel)).toEqual(['Android · Chrome']);
    // Sem chaves VAPID no teste, nada sai, mas a rota responde.
    expect((await http.post('/v1/push/test').set(me.auth).expect(201)).body).toEqual({ delivered: 0 });

    await http.delete('/v1/push/subscribe').set(me.auth).send({ endpoint }).expect(204);
    expect((await status()).devices).toHaveLength(0);
  });

  it('novo link do calendário invalida o anterior', async () => {
    const tokenFrom = (url: string) => url.split('/').pop()!.replace(/\.ics$/, '');
    const first = (await http.get('/v1/calendar/feed').set(me.auth).expect(200)).body;
    expect(first.webcalUrl).toMatch(/^webcal:/);
    const again = (await http.get('/v1/calendar/feed').set(me.auth).expect(200)).body;
    expect(again.url).toBe(first.url);

    const rotated = (await http.post('/v1/calendar/rotate').set(me.auth).expect(201)).body;
    expect(rotated.url).not.toBe(first.url);
    await http.get(`/v1/calendar/${tokenFrom(first.url)}.ics`).expect(404);
    await http.get(`/v1/calendar/${tokenFrom(rotated.url)}.ics`).expect(200);
  });
});
