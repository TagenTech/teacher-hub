# Turmei — Gestão de Aulas

Web app (PWA, mobile-first) para professores gerenciarem alunos, agenda, presença, mensalidades,
lembretes e relatórios. Cada professor cria sua conta (e-mail ou Google/Microsoft/Meta); o aluno não faz login.

Documentos: [Plano](docs/PLANO.md) · [Autenticação e cadastro](docs/AUTENTICACAO.md) · [Segurança (OWASP)](docs/SEGURANCA.md) · [Monetização (futuro)](docs/MONETIZACAO.md)

## O que tem

| Área | Recursos |
|---|---|
| **Hoje** | Resumo do dia com progresso, aulas do dia (✓ / ✗ em 1 toque ou deslizando), pendências de presença, pagamentos vencendo/atrasados com "Cobrar" e "Recebi", reposições |
| **Agenda** | Dia / Semana / Mês, cor por aluno, conflitos, nova aula avulsa ou horário fixo ("repetir toda semana") |
| **Presença** | Realizada, falta do aluno (justificada ou não), falta do professor, cancelada; regra padrão de cobrança/reposição editável; remarcar; anotações da aula |
| **Alunos** | Cadastro em 3 passos, responsável, cor/figurinha, etiquetas, busca instantânea, pausa com data de volta, arquivo, exclusão (LGPD) |
| **Planos** | Mensal, por aula ou pacote; reajuste com data (histórico preservado, +x%) |
| **Financeiro** | Mensalidades geradas sozinhas (7 dias antes), fechamento mensal das aulas, pacotes que se renovam, parcial, desconto, estorno, recibo (PDF/compartilhar), mensagem de cobrança no WhatsApp com PIX |
| **Lembretes** | Push (aula chegando, resumo às 7h, vence amanhã, atraso, aniversário, pacote acabando), feed `.ics` com alarme para o calendário do celular, som/vibração com o app aberto |
| **Relatórios** | Recebido × previsto por mês, formas de pagamento, por aluno, ranking de quem mais atrasa, frequência; filtros (período, alunos, etiquetas, forma, plano, só atrasos) salvos como atalhos; CSV para Excel |
| **Conta** | Cadastro por e-mail (com confirmação e recuperação de senha), login com Google, Microsoft e Meta, "Finalizar cadastro" com CPF e celular |
| **Dados** | Exportação completa (JSON) e planilhas |

## Estrutura

```
apps/api            NestJS 11 + TypeORM + Postgres   → http://localhost:3200/v1  (Swagger: /v1/api/docs, só fora de produção)
apps/web            Next.js 16 + Tailwind 4 (PWA)    → http://localhost:3201
packages/contracts  tipos, enums e regras puras compartilhadas (datas/fuso, dinheiro, planos, cobrança, ranking)
deploy/             nginx de produção
scripts/backup.sh   dump diário do Postgres com retenção
```

O navegador fala só com o web; `/api/v1/*` vai para a API (rewrite do Next em dev, nginx em produção).
Assim o cookie de sessão é `httpOnly` + `SameSite=Lax` (por causa da volta do login social) e não há CORS.

## Rodando local

Pré-requisitos: Node 22, pnpm 9 e Postgres (Postgres.app na 5432 ou `pnpm db:up` com Docker).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env        # JWT_SECRET, DEV_TEACHER_*, VAPID_* (npx web-push generate-vapid-keys)
cp apps/web/.env.example apps/web/.env.local
createdb gestao_aulas
pnpm --filter @turmei/contracts build
pnpm api:create-teacher                        # professor de dev (DEV_TEACHER_* do .env)
pnpm api:seed-demo                             # opcional: 8 alunos com 4 meses de histórico
pnpm dev
```

Contas: pelo app em `/cadastro` (e-mail) ou com Google/Microsoft/Meta (configure em [docs/AUTENTICACAO.md](docs/AUTENTICACAO.md)).
Também dá para criar/trocar senha pela linha de comando: `pnpm api:create-teacher --name "Nome" --email voce@email.com --password "senha-forte"`.
Sem `RESEND_API_KEY`, os links de confirmação e de senha aparecem no log da API e em `http://localhost:3200/v1/dev/outbox`.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Tudo em modo watch |
| `pnpm build` / `pnpm typecheck` / `pnpm lint` | Build e qualidade |
| `pnpm test` | Testes de unidade (contracts + API) |
| `pnpm --filter @turmei/api test:e2e` | API inteira contra Postgres real (banco `gestao_aulas_test`): `app` (fluxo e segurança), `features` (lembretes, agenda, relatórios), `gestao` (financeiro, alunos, agenda) e `conta` (sessões, senha, 2FA, ajustes, push) |
| `pnpm --filter @turmei/web test:e2e` | Fluxos principais no navegador (Playwright, celular): cadastro, aluno, aula, pagamento, relatórios, lembretes, login. Sobe API/web próprios nas portas 3210/3211 com o banco `gestao_aulas_e2e_web` zerado. `E2E_SKIP_BUILD=1` reaproveita o último build. Primeira vez: `pnpm --filter @turmei/web exec playwright install chromium` |
| `pnpm api:seed-demo` | Recria os dados de demonstração do professor de dev |
| `pnpm --filter @turmei/api migration:generate src/migrations/Nome` | Nova migration a partir das entidades |

Em dev o schema sincroniza sozinho (`TYPEORM_SYNC=true`); em produção só por migrations, aplicadas na subida da API.

## Produção (Docker)

> Passo a passo do que falta para colocar no ar (chaves, domínio, e-mail, LGPD, GitHub): **[docs/LANCAMENTO.md](docs/LANCAMENTO.md)**.
> Deploy em Cloudflare + Vercel + Supabase: **[docs/DEPLOY_VERCEL_SUPABASE.md](docs/DEPLOY_VERCEL_SUPABASE.md)**.

```bash
cp .env.prod.example .env.prod      # DOMAIN, senhas, JWT_SECRET, DATA_ENCRYPTION_KEY, BACKUP_PASSPHRASE, VAPID
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml exec api node dist/scripts/create-teacher.js --name "Nome" --email voce@email.com --password "senha-forte"
```

Sobe Postgres, API, web, **Caddy com HTTPS automático** (80/443, certificado Let's Encrypt para `DOMAIN`) e um
backup diário **cifrado** em `./backups` (14 dias). Gere as chaves com `openssl rand -base64 32` e guarde
`DATA_ENCRYPTION_KEY` e `BACKUP_PASSPHRASE` num cofre: sem elas não há como ler CPFs nem restaurar backups.
Restaurar: `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in arquivo.dump.enc -pass env:BACKUP_PASSPHRASE | pg_restore ...`.
Segurança: [docs/SEGURANCA.md](docs/SEGURANCA.md).

## Lembretes no celular

- **Android (Chrome)**: Mais → Lembretes → Ativar.
- **iPhone (iOS 16.4+)**: instale na Tela de Início (Compartilhar → Adicionar à Tela de Início), abra pelo ícone e ative.
- **Alarme garantido**: Mais → Lembretes → "iPhone / Mac" ou "Google Agenda" assina o feed `.ics`; cada aula toca no calendário do celular, mesmo com o app fechado.
