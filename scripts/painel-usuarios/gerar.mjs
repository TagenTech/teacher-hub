#!/usr/bin/env node
/**
 * Painel de usuários OFFLINE — gera um único arquivo HTML (sem servidor, sem internet) com os professores
 * cadastrados, como entram, quanto usam e quanto movimentam.
 *
 *   node scripts/painel-usuarios/gerar.mjs                 # banco local (apps/api/.env) → .local/painel-usuarios.html
 *   node scripts/painel-usuarios/gerar.mjs --demo          # dados de exemplo, sem banco nenhum
 *   node scripts/painel-usuarios/gerar.mjs --out /caminho/painel.html
 *   PAINEL_DATABASE_URL=postgres://… node scripts/painel-usuarios/gerar.mjs --allow-remote   # banco remoto (produção): ver docs abaixo
 *   node scripts/painel-usuarios/gerar.mjs --db postgres://…   # outro banco (ex.: uma cópia/dump restaurado)
 *
 * Segurança:
 * - SOMENTE LEITURA: tudo roda numa transação `READ ONLY` que é descartada (rollback). Nunca escreve.
 * - SÓ BANCO LOCAL por padrão: recusa qualquer host que não seja localhost. Para olhar dados de produção,
 *   restaure uma cópia na sua máquina e aponte `--db` para ela (ou use `--allow-remote` sabendo o que faz).
 * - Nunca lê senha, token, chave ou segredo de 2FA; o CPF sai só mascarado (`***.982.247-**`); IPs saem mascarados.
 * - NÃO acessa dados financeiros: não consulta cobranças, pagamentos, valores nem chave PIX (nem sequer as tabelas).
 * - O arquivo gerado tem dados pessoais: fica em `.local/` (ignorado pelo git). Não publique nem anexe em chats.
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const requireFromApi = createRequire(join(root, 'apps', 'api', 'package.json'));

// ---------------------------------------------------------------- argumentos
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const OUT = resolve(value('--out') ?? join(root, '.local', 'painel-usuarios.html'));
const DEMO = flag('--demo');

// ---------------------------------------------------------------- utilidades
function loadEnvFile(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

function maskIp(ip) {
  if (!ip) return null;
  if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') return 'local';
  const v4 = ip.replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.split('.').slice(0, 2).join('.') + '.x.x';
  return ip.split(':').slice(0, 3).join(':') + ':…';
}

const iso = (d) => (d ? new Date(d).toISOString() : null);
const num = (v) => Number(v ?? 0);
const maxIso = (...xs) => xs.filter(Boolean).sort().pop() ?? null;

let contracts = {};
try {
  contracts = requireFromApi('@turmei/contracts');
} catch {
  console.warn('Aviso: @turmei/contracts não está compilado (pnpm --filter @turmei/contracts build) — rótulos simplificados.');
}
const EVENT_LABEL = contracts.SECURITY_EVENT_LABEL ?? {};
const deviceLabel = contracts.deviceLabel ?? ((ua) => (ua ? 'Aparelho' : '—'));

// ---------------------------------------------------------------- dados reais
async function fromDatabase() {
  const fileEnv = loadEnvFile(join(root, 'apps', 'api', '.env'));
  // Banco do painel: --db, PAINEL_DATABASE_URL (variável ou .local/painel.env) e, por último, o banco local da API.
  // Fica separado de DATABASE_URL de propósito: assim a API local nunca aponta para produção sem querer.
  const painelEnv = loadEnvFile(join(root, '.local', 'painel.env'));
  const url = value('--db') ?? process.env.PAINEL_DATABASE_URL ?? painelEnv.PAINEL_DATABASE_URL ?? process.env.DATABASE_URL ?? fileEnv.DATABASE_URL;
  if (!url) throw new Error('Sem DATABASE_URL. Use --db postgres://… ou configure apps/api/.env (ou use --demo).');

  const parsed = new URL(url);
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname);
  if (!local && !flag('--allow-remote')) {
    throw new Error(
      `Recusado: o banco "${parsed.hostname}" não é local. Este painel só lê bancos da sua máquina.\n` +
        '  Para ver dados de produção, restaure uma cópia local e use --db, ou passe --allow-remote conscientemente.',
    );
  }

  const { Client } = requireFromApi('pg');
  const db = new Client({ connectionString: url, ssl: parsed.searchParams.get('sslmode') === 'require' ? { rejectUnauthorized: false } : undefined });
  await db.connect();
  await db.query('BEGIN READ ONLY');
  try {
    // Prefixo das tabelas: `turmei_` (develop/produção) ou nenhum (banco antigo). Escolhe o que tem professores.
    const exists = async (t) => (await db.query('SELECT to_regclass($1) AS r', [`public.${t}`])).rows[0].r !== null;
    const candidates = [];
    for (const prefix of value('--prefix') !== undefined ? [value('--prefix')] : ['turmei_', '']) {
      if (await exists(`${prefix}teachers`)) {
        const n = num((await db.query(`SELECT count(*) AS n FROM "${prefix}teachers"`)).rows[0].n);
        candidates.push({ prefix, n });
      }
    }
    if (!candidates.length) throw new Error('Não achei a tabela de professores (nem "turmei_teachers" nem "teachers").');
    const { prefix: P, n: teacherCount } = candidates.sort((a, b) => b.n - a.n)[0];
    const T = (name) => `"${P}${name}"`;
    const optional = async (sql, params = []) => {
      try {
        await db.query('SAVEPOINT s');
        const r = await db.query(sql, params);
        await db.query('RELEASE SAVEPOINT s');
        return r.rows;
      } catch (err) {
        await db.query('ROLLBACK TO SAVEPOINT s');
        console.warn(`Aviso: consulta ignorada (${err.message.split('\n')[0]})`);
        return [];
      }
    };

    const teachers = (
      await db.query(`
        SELECT id, name, email, (password_hash IS NOT NULL) AS has_password, timezone, created_at, email_verified_at,
               phone, city, state, cpf_masked, profile_completed_at, terms_accepted_at, mfa_enabled_at,
               lesson_reminder_minutes
          FROM ${T('teachers')} ORDER BY created_at`)
    ).rows;

    const identities = await optional(`SELECT teacher_id, provider FROM ${T('auth_identities')}`);
    const lastRefresh = await optional(`SELECT teacher_id, max(created_at) AS at FROM ${T('refresh_tokens')} GROUP BY 1`);
    const sessions = await optional(`
      SELECT DISTINCT ON (teacher_id, session_id) teacher_id, session_id, user_agent, ip, created_at AS last_at, session_started_at
        FROM ${T('refresh_tokens')} WHERE revoked_at IS NULL AND expires_at > now()
       ORDER BY teacher_id, session_id, created_at DESC`);
    const push = await optional(`SELECT teacher_id, count(*)::int AS n FROM ${T('push_subscriptions')} GROUP BY 1`);
    const eventAgg = await optional(`
      SELECT teacher_id, type, count(*)::int AS n, max(created_at) AS last_at,
             count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS n30
        FROM ${T('security_events')} WHERE teacher_id IS NOT NULL GROUP BY 1, 2`);
    const events = await optional(`
      SELECT teacher_id, type, ip, user_agent, created_at FROM (
        SELECT teacher_id, type, ip, user_agent, created_at,
               row_number() OVER (PARTITION BY teacher_id ORDER BY created_at DESC) AS rn
          FROM ${T('security_events')} WHERE teacher_id IS NOT NULL) e
       WHERE rn <= 25 ORDER BY created_at DESC`);
    const loginsByDay = await optional(`
      SELECT to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS d, count(*)::int AS n
        FROM ${T('security_events')} WHERE type = 'LOGIN_OK' AND created_at > now() - interval '30 days' GROUP BY 1 ORDER BY 1`);
    const students = await optional(`SELECT teacher_id, status, count(*)::int AS n FROM ${T('students')} GROUP BY 1, 2`);
    const lessons = await optional(`
      SELECT teacher_id,
             count(*)::int AS total,
             count(*) FILTER (WHERE status = 'REALIZADA')::int AS realized,
             count(*) FILTER (WHERE status = 'REALIZADA' AND starts_at > now() - interval '30 days')::int AS realized30,
             count(*) FILTER (WHERE status = 'AGENDADA' AND starts_at > now())::int AS upcoming,
             max(starts_at) FILTER (WHERE status = 'REALIZADA') AS last_at
        FROM ${T('lessons')} GROUP BY 1`);
    // Dados financeiros (cobranças, pagamentos, valores, PIX) NÃO são lidos: o painel nunca consulta essas tabelas.
    const by = (rows) => {
      const m = new Map();
      for (const r of rows) m.set(r.teacher_id, [...(m.get(r.teacher_id) ?? []), r]);
      return m;
    };
    const [idsBy, refBy, sesBy, pushBy, aggBy, evBy, stuBy, lesBy] = [
      identities, lastRefresh, sessions, push, eventAgg, events, students, lessons,
    ].map(by);

    const users = teachers.map((t) => {
      const agg = aggBy.get(t.id) ?? [];
      const ev = (type) => agg.find((a) => a.type === type);
      const stu = Object.fromEntries((stuBy.get(t.id) ?? []).map((r) => [r.status, r.n]));
      const les = (lesBy.get(t.id) ?? [])[0];
      const lastLogin = iso(ev('LOGIN_OK')?.last_at);
      const lastRef = iso((refBy.get(t.id) ?? [])[0]?.at);
      return {
        id: t.id,
        name: t.name,
        email: t.email,
        emailVerified: !!t.email_verified_at,
        hasPassword: t.has_password,
        providers: [...new Set((idsBy.get(t.id) ?? []).map((i) => i.provider))],
        createdAt: iso(t.created_at),
        termsAcceptedAt: iso(t.terms_accepted_at),
        phone: t.phone,
        city: t.city,
        state: t.state,
        cpfMasked: t.cpf_masked,
        profileCompletedAt: iso(t.profile_completed_at),
        mfa: !!t.mfa_enabled_at,
        timezone: t.timezone,
        reminders: { lessonMinutes: t.lesson_reminder_minutes },
        lastLoginAt: lastLogin,
        lastActivityAt: maxIso(lastLogin, lastRef),
        loginCount: num(ev('LOGIN_OK')?.n),
        failedLogins30: num(ev('LOGIN_FAIL')?.n30) + num(ev('LOGIN_LOCKED')?.n30),
        sessions: (sesBy.get(t.id) ?? []).map((s) => ({
          device: deviceLabel(s.user_agent),
          ip: maskIp(s.ip),
          lastActiveAt: iso(s.last_at),
          startedAt: iso(s.session_started_at),
        })),
        pushDevices: num((pushBy.get(t.id) ?? [])[0]?.n),
        students: {
          total: Object.values(stu).reduce((s, n) => s + n, 0),
          active: stu.ATIVO ?? 0,
          paused: stu.PAUSADO ?? 0,
          inactive: stu.INATIVO ?? 0,
        },
        lessons: {
          total: num(les?.total),
          realized: num(les?.realized),
          realized30: num(les?.realized30),
          upcoming: num(les?.upcoming),
          lastAt: iso(les?.last_at),
        },
        events: (evBy.get(t.id) ?? []).map((e) => ({ type: e.type, at: iso(e.created_at), device: deviceLabel(e.user_agent), ip: maskIp(e.ip) })),
      };
    });

    return {
      users,
      loginsByDay,
      source: `${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}`,
      prefix: P || '(sem prefixo)',
      teacherCount,
    };
  } finally {
    await db.query('ROLLBACK').catch(() => undefined);
    await db.end();
  }
}

// ---------------------------------------------------------------- dados de exemplo (--demo)
function demoData() {
  let seed = 20261026;
  const rnd = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
  const chance = (p) => rnd() < p;
  const now = Date.now();
  const day = 86_400_000;
  const first = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elaine', 'Fábio', 'Gabriela', 'Hugo', 'Isabela', 'João', 'Karen', 'Lucas', 'Marina', 'Nuno', 'Olívia', 'Paulo', 'Quésia', 'Rafael', 'Sofia', 'Tiago'];
  const last = ['Almeida', 'Barros', 'Cardoso', 'Duarte', 'Esteves', 'Farias', 'Guedes', 'Holanda', 'Ibrahim', 'Junqueira'];
  const cities = [['São Paulo', 'SP'], ['Rio de Janeiro', 'RJ'], ['Belo Horizonte', 'MG'], ['Curitiba', 'PR'], ['Porto Alegre', 'RS'], ['Recife', 'PE'], ['Salvador', 'BA'], ['Fortaleza', 'CE']];
  const devices = ['iPhone · Safari', 'Android · Chrome', 'Windows · Chrome', 'Mac · Safari', 'Mac · Chrome'];
  const types = Object.keys(EVENT_LABEL).length ? Object.keys(EVENT_LABEL) : ['LOGIN_OK', 'LOGIN_FAIL', 'PASSWORD_CHANGED'];
  const users = [];
  const loginsByDay = new Map();
  const ymd = (ms) => new Date(ms - 3 * 3_600_000).toISOString().slice(0, 10);

  for (let i = 0; i < 38; i++) {
    const age = Math.floor(rnd() ** 1.4 * 300) + 1; // dias desde o cadastro (mais gente recente)
    const created = now - age * day - Math.floor(rnd() * day);
    const name = `${pick(first)} ${pick(last)}`;
    const provider = chance(0.35) ? pick(['google', 'google', 'microsoft', 'facebook']) : null;
    const hasPassword = !provider || chance(0.3);
    const verified = !!provider || chance(0.78);
    const profile = verified && chance(0.62);
    const [city, state] = pick(cities);
    const engaged = verified && chance(0.8);
    const stuTotal = engaged ? Math.floor(rnd() ** 1.5 * 26) : 0;
    const paused = Math.floor(stuTotal * rnd() * 0.12);
    const inactive = Math.floor(stuTotal * rnd() * 0.15);
    const lessonsTotal = stuTotal ? Math.floor(stuTotal * (4 + rnd() * 14) * Math.min(1, age / 90)) : 0;
    const realized = Math.floor(lessonsTotal * (0.72 + rnd() * 0.2));
    const daysSince = engaged ? Math.floor(rnd() ** 2 * Math.min(age, 60)) : Math.min(age, Math.floor(rnd() * 120));
    const lastLogin = Math.min(now, created + (age - Math.min(age, daysSince)) * day);
    const logins = 1 + Math.floor(rnd() * 3) * Math.min(age, 40);
    const events = [];
    for (let e = 0; e < Math.min(12, logins); e++) {
      const at = Math.min(now, lastLogin - e * day * (0.3 + rnd() * 2));
      events.push({ type: e === 0 || chance(0.8) ? 'LOGIN_OK' : pick(types), at: new Date(at).toISOString(), device: pick(devices), ip: `${100 + Math.floor(rnd() * 90)}.${Math.floor(rnd() * 250)}.x.x` });
    }
    for (const ev of events) if (ev.type === 'LOGIN_OK' && now - Date.parse(ev.at) < 30 * day) loginsByDay.set(ymd(Date.parse(ev.at)), (loginsByDay.get(ymd(Date.parse(ev.at))) ?? 0) + 1);
    users.push({
      id: `demo-${i}`,
      name,
      email: `${name.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').replace(' ', '.')}${i}@exemplo.test`,
      emailVerified: verified,
      hasPassword,
      providers: provider ? [provider] : [],
      createdAt: new Date(created).toISOString(),
      termsAcceptedAt: new Date(created).toISOString(),
      phone: profile ? `119${String(Math.floor(rnd() * 1e8)).padStart(8, '0')}` : null,
      city: profile ? city : null,
      state: profile ? state : null,
      cpfMasked: profile ? `***.${String(Math.floor(rnd() * 900) + 100)}.${String(Math.floor(rnd() * 900) + 100)}-**` : null,
      profileCompletedAt: profile ? new Date(created + day).toISOString() : null,
      mfa: profile && chance(0.18),
      timezone: 'America/Sao_Paulo',
      reminders: { lessonMinutes: 30 },
      lastLoginAt: new Date(lastLogin).toISOString(),
      lastActivityAt: new Date(Math.min(now, lastLogin + rnd() * day)).toISOString(),
      loginCount: logins,
      failedLogins30: chance(0.12) ? 1 + Math.floor(rnd() * 6) : 0,
      sessions: Array.from({ length: engaged ? 1 + Math.floor(rnd() * 2) : 0 }, () => ({ device: pick(devices), ip: 'local', lastActiveAt: new Date(lastLogin).toISOString(), startedAt: new Date(created).toISOString() })),
      pushDevices: engaged && chance(0.5) ? 1 : 0,
      students: { total: stuTotal, active: stuTotal - paused - inactive, paused, inactive },
      lessons: { total: lessonsTotal, realized, realized30: Math.min(realized, Math.floor(realized * Math.min(1, 30 / Math.max(age, 30)) * 1.4)), upcoming: stuTotal ? Math.floor(rnd() * 20) : 0, lastAt: realized ? new Date(now - Math.floor(rnd() * 20) * day).toISOString() : null },
      events,
    });
  }
  users.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    users,
    loginsByDay: [...loginsByDay.entries()].sort().map(([d, n]) => ({ d, n })),
    source: 'dados de exemplo (nenhum banco foi lido)',
    prefix: '—',
    teacherCount: users.length,
  };
}

// ---------------------------------------------------------------- saída
let result;
try {
  result = DEMO ? demoData() : await fromDatabase();
} catch (err) {
  console.error(`\nErro: ${err.message}`);
  process.exit(1);
}
const payload = {
  meta: {
    generatedAt: new Date().toISOString(),
    source: result.source,
    prefix: result.prefix,
    demo: DEMO,
  },
  labels: { events: EVENT_LABEL },
  users: result.users,
  loginsByDay: result.loginsByDay,
};

// `<` escapado: o JSON vai dentro de uma <script>; nomes de usuário são texto livre.
const json = JSON.stringify(payload)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');
const template = readFileSync(join(here, 'template.html'), 'utf8');
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, template.replace('/*__DADOS__*/null', () => json), { mode: 0o600 });
console.log(`Painel gerado: ${OUT}`);
console.log(`  ${payload.users.length} usuário(s) · origem: ${payload.meta.source}${DEMO ? '' : ` · tabelas: ${payload.meta.prefix}`}`);
console.log('  Abra o arquivo no navegador (funciona sem internet). Contém dados pessoais — não compartilhe.');
