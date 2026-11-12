/**
 * Provisiona no backoffice Tagen os professores já cadastrados (o cadastro
 * público já provisiona sozinho; este script cobre os anteriores à integração).
 *
 *   pnpm api:backfill-tagen                 # envia de verdade
 *   pnpm api:backfill-tagen -- --dry-run    # só lista
 *
 * Env: DATABASE_URL + TAGEN_BACKOFFICE_URL + TAGEN_BACKOFFICE_API_KEY.
 * Idempotente: o backoffice deduplica por e-mail/referência externa.
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TeachersService } from '../professor/teachers.service';
import type { Teacher } from '../professor/entities/teacher.entity';

const DRY_RUN = process.argv.includes('--dry-run');
const TIMEOUT_MS = 10_000;

async function provision(teacher: Teacher, url: string, apiKey: string): Promise<number> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tagen-api-key': apiKey },
    body: JSON.stringify({
      name: teacher.name,
      email: teacher.email,
      external_ref: teacher.id,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return res.status;
}

async function main() {
  const base = process.env.TAGEN_BACKOFFICE_URL?.replace(/\/$/, '');
  const apiKey = process.env.TAGEN_BACKOFFICE_API_KEY;
  if (!base || !apiKey) {
    console.error('Defina TAGEN_BACKOFFICE_URL e TAGEN_BACKOFFICE_API_KEY.');
    process.exit(1);
  }
  const url = `${base}/api/provision`;

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const teachers = await app.get(TeachersService).findAll();
  await app.close();

  console.log(`${teachers.length} professor(es) encontrado(s)${DRY_RUN ? ' (dry-run)' : ''}`);
  let sent = 0;
  let failed = 0;
  for (const t of teachers) {
    if (DRY_RUN) {
      console.log(`  would provision: ${t.name} <${t.email}>`);
      continue;
    }
    try {
      const status = await provision(t, url, apiKey);
      if (status === 200 || status === 201) {
        sent += 1;
        console.log(`  ok ${status}: ${t.email}`);
      } else {
        failed += 1;
        console.log(`  FALHA ${status}: ${t.email}`);
      }
    } catch (err) {
      failed += 1;
      console.log(`  FALHA rede: ${t.email} — ${(err as Error).message}`);
    }
  }
  console.log(`Pronto: ${sent} enviadas, ${failed} falhas.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
