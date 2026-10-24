import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

export const ALL_TABLES =
  'teachers, auth_identities, email_tokens, mfa_recovery_codes, security_events, students, billing_plans, recurring_slots, lessons, makeup_credits, schedule_blocks, charges, payments, refresh_tokens, saved_filters, notification_logs, push_subscriptions';

/** Sobe a API completa (mesma configuração do main.ts) com o banco de teste zerado. */
export async function createTestApp(): Promise<INestApplication> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  await app.get(DataSource).query(`TRUNCATE ${ALL_TABLES} CASCADE`);
  return app;
}

type Http = ReturnType<typeof request>;

/**
 * Cria uma conta pelo cadastro público e devolve o token e o cookie da sessão.
 * Usa o cadastro (e não o login) para não gastar o limite de 5 logins/min por IP.
 */
export async function registerTeacher(http: Http, name: string, email: string, password = 'senha-forte-123') {
  const res = await http.post('/v1/auth/register').send({ name, email, password, acceptTerms: true }).expect(201);
  const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('turmei_refresh='))!.split(';')[0];
  return {
    id: res.body.teacher.id as string,
    token: res.body.accessToken as string,
    auth: { authorization: `Bearer ${res.body.accessToken}` },
    cookie,
    email,
    password,
  };
}
