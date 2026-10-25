# Turmei — guia rápido para agentes

Monorepo pnpm + Turbo. Leia o [README](README.md) e o [docs/PLANO.md](docs/PLANO.md).

## Convenções
- Textos de interface e mensagens de erro em **português (pt-BR)**, tom acolhedor e curto.
- **Dinheiro em centavos** (int). **Datas de calendário** como `'YYYY-MM-DD'`; instantes em UTC; "hoje" sempre `todayIn(teacher.timezone)` (`packages/contracts/src/time.ts`, `dates.ts`).
- **Regras puras** (status de cobrança, regra de presença, planos, ranking) ficam em `packages/contracts` com testes — API e web usam as mesmas. Depois de mudar contracts: `pnpm --filter @turmei/contracts build`.
- **Status de cobrança é calculado** (`chargeStatus`), nunca gravado.
- Toda consulta filtra por `teacherId` do JWT (cada professor é uma conta isolada). Rotas são protegidas por padrão; pública só com `@Public()`.
- Autenticação: e-mail/senha + Google/Microsoft/Meta (OAuth no servidor, `src/auth/oauth.service.ts`). Ver `docs/AUTENTICACAO.md`.
  Em dev sem `RESEND_API_KEY`, links de e-mail ficam em `GET /v1/dev/outbox`.
- CPF é dado pessoal: cifrado no banco (AES-256-GCM), nunca volta inteiro para o navegador (`cpfMasked`).
- Cobrança da licença ainda não existe — o plano está em `docs/MONETIZACAO.md`.
- Módulos da API se falam por eventos (`src/common/events.ts`, `@nestjs/event-emitter`) para evitar dependência circular.
- Dev usa `synchronize`; produção usa migrations (`src/migrations`). Mudou entidade → gere migration.
- Migrations que criam tabelas devem chamar `lockdownSupabaseTables(queryRunner)` (`src/database/supabase-lockdown.ts`).

## Segurança (ver docs/SEGURANCA.md)
- Sem `NODE_ENV` a API assume **produção** (sem Swagger/rotas de dev). Dev usa `NODE_ENV=development` no `.env`.
- URLs que o servidor chama precisam de allowlist (ex.: push em `lembretes/push-endpoint.ts`) — evitar SSRF.
- Texto do usuário em HTML de e-mail → `escapeHtml`; em CSV → neutralizar `= + - @`; redirects → `safeNext`.
- Mensagens vindas da URL (`?erro=`) só por código fixo, nunca texto livre.
- Rode `pnpm audit` antes de subir dependências novas.
- Dado pessoal sensível no banco → `encryptField`/`blindIndex` (`common/crypto/field-crypto.ts`), coluna `select: false`.
- Ações de segurança → `SecurityEventsService.record`; invalidar sessões → `SessionRevocationService`.
- Script inline no web precisa do nonce (`x-nonce` em `headers()`); a CSP vem do `proxy.ts`.

## Web
- Next.js 16 (`proxy.ts` no lugar de middleware). Consulte `node_modules/next/dist/docs/` antes de usar APIs novas.
- Tokens de cor em `src/app/globals.css` (claro/escuro, cores dos alunos `--stu-*`, gráficos `--chart-*`). Não use `dark:` do Tailwind: o tema manual usa `data-theme`.
- Folhas (bottom sheets) globais: `useLessonActions()` (aulas) e `useFinanceActions()` (cobranças).
- Valores do navegador (data/hora, localStorage) via `useHydrated()` / `useNow()` — o lint proíbe `setState` em effect.
- Rotas dinâmicas novas exigem reiniciar o `next dev`.

## Verificação
`pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @turmei/api test:e2e && pnpm build && pnpm --filter @turmei/web test:e2e`

Testes: regras em `packages/contracts/*.spec.ts`; API em `src/**/*.spec.ts` (unidade) e `test/*.e2e-spec.ts` (Postgres real, setup em `test/env.ts`/`helpers.ts`); web em `apps/web/e2e` (Playwright, seletores por rótulo/papel acessível). Funcionalidade nova → teste junto.
