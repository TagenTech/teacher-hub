import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RemindersService } from '../src/lembretes/reminders.service';
import { createTestApp } from './helpers';

describe('Jobs internos (e2e)', () => {
  let disabledApp: INestApplication;
  let app: INestApplication;
  const cronSecret = 'e2e-cron-secret-with-at-least-32-characters';
  const previousCronSecret = process.env.CRON_SECRET;

  beforeAll(async () => {
    delete process.env.CRON_SECRET;
    disabledApp = await createTestApp();
  });

  afterAll(async () => {
    await disabledApp?.close();
    await app?.close();
    if (previousCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousCronSecret;
  });

  it('retorna 404 quando CRON_SECRET não está configurado', async () => {
    await request(disabledApp.getHttpServer()).post('/v1/internal/jobs/reminders').expect(404);
  });

  it('exige token, executa os jobs conhecidos e recusa nomes desconhecidos', async () => {
    await disabledApp.close();
    process.env.CRON_SECRET = cronSecret;
    app = await createTestApp();
    jest.spyOn(app.get(RemindersService), 'tick').mockResolvedValue();
    const http = request(app.getHttpServer());

    await http.post('/v1/internal/jobs/reminders').expect(401);
    await http.post('/v1/internal/jobs/reminders').set('Authorization', 'Bearer token-errado').expect(401);
    const res = await http
      .post('/v1/internal/jobs/reminders')
      .set('Authorization', `Bearer ${cronSecret}`)
      .expect(200);
    expect(res.body).toEqual(expect.objectContaining({ job: 'reminders', ok: true }));
    expect(res.body.ms).toEqual(expect.any(Number));
    await http
      .post('/v1/internal/jobs/desconhecido')
      .set('Authorization', `Bearer ${cronSecret}`)
      .expect(404);
  });
});
