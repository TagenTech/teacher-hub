/**
 * Provisiona no backoffice Tagen os professores já cadastrados (o cadastro
 * público já provisiona sozinho; este script cobre os anteriores à integração).
 *
 *   pnpm --filter @turmei/api backfill-tagen -- --dry-run   # só lista
 *   pnpm --filter @turmei/api backfill-tagen                # envia de verdade
 *
 * Env: DATABASE_URL + TAGEN_BACKOFFICE_URL + TAGEN_BACKOFFICE_API_KEY.
 * Idempotente: o backoffice deduplica por external_ref (id do professor).
 * Standalone (pg direto): não sobe o NestJS — roda em CI sem JWT_SECRET.
 */
import 'dotenv/config';
import { Client } from 'pg';

const DRY_RUN = process.argv.includes('--dry-run');
const TIMEOUT_MS = 10_000;

interface TeacherRow {
  id: string;
  name: string;
  email: string;
}

async function provision(teacher: TeacherRow, url: string, apiKey: string): Promise<number> {
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
  const databaseUrl = process.env.DATABASE_URL;
  if (!base || !apiKey || !databaseUrl) {
    console.error('Defina TAGEN_BACKOFFICE_URL, TAGEN_BACKOFFICE_API_KEY e DATABASE_URL.');
    process.exit(1);
  }
  const url = `${base}/api/provision`;

  // sslmode na URL vira verify-full no pg novo e quebra no pooler do Supabase;
  // removemos os parâmetros SSL e controlamos o TLS pela opção `ssl`.
  let cleanUrl = databaseUrl;
  try {
    const u = new URL(databaseUrl);
    u.searchParams.delete('sslmode');
    u.searchParams.delete('uselibpqcompat');
    cleanUrl = u.toString();
  } catch { /* URL fora do padrão: segue como veio */ }

  const client = new Client({
    connectionString: cleanUrl,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  const { rows: teachers } = await client.query<TeacherRow>(
    'SELECT id, name, email FROM turmei_teachers ORDER BY created_at',
  );
  await client.end();

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
