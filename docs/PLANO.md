# Gestão de Aulas — Plano de Arquitetura e Produto

> Web app (PWA, mobile-first) para **um professor** gerenciar alunos, agenda, presença, mensalidades, lembretes e relatórios.
> O aluno **não** faz login: só o professor tem acesso.
> Arquitetura baseada no monorepo de referência `smartreparo-mvp` (pnpm + Turbo, NestJS + TypeORM + Postgres, Next.js + Tailwind + Radix), simplificada para o tamanho deste produto.

Nome do app: **Turmei**.

> **Status (23/10/2026):** fases 0 a 6 implementadas. Como rodar e o que cada tela faz: [README](../README.md).

---

## 1. Visão do produto

### O que o professor faz no app

| Área | O que resolve |
|---|---|
| **Alunos** | Cadastro do aluno (e do responsável, se for menor), contato/WhatsApp, cor do aluno na agenda, observações, status (ativo / pausado / inativo). |
| **Planos de cobrança** | Como cada aluno paga: **mensal fixo**, **por aula** ou **pacote de N aulas**. Valor, dia de vencimento, histórico de reajustes. |
| **Agenda** | Horários fixos semanais (ex.: toda terça 19h) que geram as aulas automaticamente, e aulas avulsas. Visão Dia / Semana / Mês. |
| **Presença** | Marcar cada aula: **realizada**, **falta do aluno**, **falta do professor**, **cancelada** ou **remarcada**, com justificativa e decisão se a aula é cobrada ou não. |
| **Reposições** | Falta do professor ou falta justificada do aluno gera um **crédito de reposição** que o professor agenda depois. |
| **Financeiro** | Cobranças do mês (mensalidade ou soma das aulas), registro de pagamento (data, valor, forma — PIX, dinheiro, cartão, transferência), pagamento parcial, desconto, status: pendente / pago / atrasado / parcial. |
| **Lembretes** | Alarme antes de cada aula (ex.: 30 min) e lembrete de pagamento **1 dia antes do vencimento**, mais aviso no dia de atraso. |
| **Relatórios** | Total recebido, previsto × recebido, em atraso, **ranking de quem mais atrasa**, frequência e faltas, tudo com **filtros personalizados que podem ser salvos**. Exportação para CSV. |

### Complementos que eu adicionei (faltavam na ideia original)

1. **Cobrar pelo WhatsApp com um toque**: como o aluno não loga, o app gera a mensagem pronta ("Oi Ana! Sua mensalidade de outubro (R$ 280,00) vence amanhã. PIX: ...") e abre o WhatsApp com ela já escrita (`wa.me`). Nenhuma integração paga é necessária.
2. **Crédito de reposição**: controle de aulas devidas ao aluno, para nada se perder.
3. **Pausar aluno** (férias / viagem): para de gerar aulas e cobranças sem apagar o histórico.
4. **Bloqueios de agenda**: feriados e folgas do professor; as aulas daquele dia são marcadas como "cancelada — professor" de uma vez.
5. **Histórico de preço**: reajuste a partir de uma data, sem alterar cobranças antigas.
6. **Responsável financeiro**: para aluno menor de idade, quem paga e quem recebe a cobrança.
7. **Recibo**: gerar e compartilhar um comprovante (imagem/PDF) do pagamento.
8. **Anotações da aula**: o que foi ensinado / tarefa passada (histórico pedagógico do aluno).
9. **Aniversários**: lembrete no dia (toque carinhoso que fideliza o aluno).
10. **Agenda no calendário do celular**: link `.ics` que o professor assina no Google Calendar / iPhone, com alarme nativo (veja a seção 6).
11. **Modo escuro**, **backup/exportação dos dados** e cuidado com a **LGPD** (dados de menores).

---

## 2. Arquitetura

### Decisões e motivos

| Decisão | Motivo |
|---|---|
| **Monorepo pnpm + Turbo** (igual à referência) | Tipos compartilhados entre API e web; um comando roda tudo. |
| **API NestJS 10 + TypeORM + Postgres** (igual à referência) | Padrão de módulos já conhecido, guards globais, `@nestjs/schedule` para os crons de lembrete. |
| **Web Next.js 16 + Tailwind 4 + Radix/shadcn** (igual à referência) | Mesmo design system base; PWA instalável. |
| **Sem BFF** (diferente da referência) | Há um único cliente (o web app). Um BFF só adicionaria latência e manutenção. Se um app nativo vier depois, o BFF pode ser criado. |
| **Next sem `output: 'export'`** | Permite rotas `[id]` normais (a referência precisou usar `?id=` por causa do export estático). |
| **`teacherId` em todas as tabelas** | Hoje é 1 professor, mas o app já nasce pronto para virar multi-professor (SaaS) sem migração dolorosa. |
| **Dinheiro em centavos (inteiro)** | Evita erro de arredondamento. `28000` = R$ 280,00. |
| **Datas em UTC no banco, fuso `America/Sao_Paulo` na regra** | Lembretes e vencimentos corretos, inclusive se o professor viajar. |
| **Status de atraso calculado, não gravado** | "Atrasado" = vencimento < hoje e saldo > 0. Nunca fica desatualizado. |

### Diagrama

```
 Celular do professor (PWA instalado)
 ┌──────────────────────────────────────┐
 │ apps/web  (Next.js 16, Tailwind 4)   │
 │  • TanStack Query (cache + otimista) │
 │  • Service Worker (push + offline)   │
 └───────────────┬──────────────────────┘
                 │ HTTPS  /v1/*  (JWT)
 ┌───────────────▼──────────────────────┐        ┌──────────────────────┐
 │ apps/api  (NestJS 10)                │        │ Web Push (VAPID)      │
 │  módulos: auth, alunos, planos,      ├───────▶│ FCM / APNs / Mozilla  │
 │  agenda, aulas, financeiro,          │        └──────────────────────┘
 │  lembretes, relatorios, config       │
 │  @nestjs/schedule → crons            │──▶ feed .ics (calendário do celular)
 └───────────────┬──────────────────────┘
                 │ TypeORM
          ┌──────▼──────┐
          │ PostgreSQL  │
          └─────────────┘
```

### Estrutura de pastas

```
gestao-aulas/
├── apps/
│   ├── api/                      # NestJS — porta 3200, prefixo /v1
│   │   └── src/
│   │       ├── auth/             # login, refresh, troca de senha
│   │       ├── professor/        # perfil + configurações (chave PIX, antecedência dos lembretes)
│   │       ├── alunos/           # alunos + planos de cobrança (com histórico de preço)
│   │       ├── agenda/           # horários recorrentes, bloqueios, geração de aulas
│   │       ├── aulas/            # ocorrências, presença, reposições
│   │       ├── financeiro/       # cobranças + pagamentos
│   │       ├── lembretes/        # crons, web push, feed .ics
│   │       ├── relatorios/       # consultas agregadas + filtros salvos + CSV
│   │       ├── common/           # guards, decorators, filtros, utils de data/dinheiro
│   │       └── config/
│   └── web/                      # Next.js 16 PWA — porta 3201
│       └── src/
│           ├── app/
│           │   ├── (auth)/login/
│           │   └── (app)/
│           │       ├── hoje/             # tela inicial
│           │       ├── agenda/
│           │       ├── alunos/  [id]/
│           │       ├── financeiro/
│           │       ├── relatorios/
│           │       └── ajustes/
│           ├── components/
│           │   ├── ui/           # botões, cards, sheet, chips, skeleton...
│           │   ├── layout/       # app-shell, bottom-nav, FAB, header
│           │   └── <domínio>/    # lesson-card, payment-sheet, student-avatar...
│           ├── lib/api/          # client + funções por domínio
│           └── sw/               # service worker (push, cache)
├── packages/
│   ├── contracts/                # enums, tipos de DTO, regras puras (dinheiro, datas, status)
│   └── tsconfig/                 # tsconfig base
├── docs/
├── docker-compose.yml            # postgres (dev) / stack completa (prod)
├── package.json  pnpm-workspace.yaml  turbo.json
```

### Bibliotecas principais

- **API**: `@nestjs/*`, `typeorm`, `pg`, `class-validator`, `@nestjs/schedule`, `@nestjs/throttler`, `helmet`, `bcrypt`, `web-push`, `ics`, `date-fns` + `date-fns-tz`.
- **Web**: `next@16`, `react@19`, `tailwindcss@4`, `@radix-ui/*`, `class-variance-authority`, `lucide-react`, `@tanstack/react-query`, `react-hook-form` + `zod`, `date-fns`, `recharts` (gráficos), `vaul` (bottom sheets com gesto), `sonner` (toasts), `canvas-confetti` (celebração), `serwist` (service worker no Next).

---

## 3. Modelo de dados

```
Teacher 1──* Student 1──* BillingPlan        (histórico: validFrom/validTo)
                 │  1──* RecurringSlot ──gera──▶ Lesson
                 │  1──* Lesson ──* MakeupCredit
                 │  1──* Charge 1──* Payment
Teacher 1──* ScheduleBlock   (feriados/folgas)
Teacher 1──* PushSubscription
Teacher 1──* SavedFilter
Teacher 1──* NotificationLog (o que já foi enviado — evita duplicar)
```

### Entidades

**Teacher** — `id, name, email, passwordHash, timezone ('America/Sao_Paulo'), pixKey, pixKeyType, lessonReminderMinutes (padrão 30), paymentReminderHour (padrão 9), whatsappTemplate, icsToken, createdAt`

**Student** — `id, teacherId, name, nickname, phone, email, birthDate, guardianName, guardianPhone, payerIsGuardian, color (pastel da agenda), emoji/avatar, status: ATIVO | PAUSADO | INATIVO, pausedUntil, startDate, tags[], notes, createdAt`

**BillingPlan** — `id, studentId, type: MENSAL | POR_AULA | PACOTE, monthlyFeeCents, lessonPriceCents, packageLessons, packagePriceCents, dueDay (1–28), validFrom, validTo`
- Reajuste = fecha o plano atual (`validTo`) e cria outro. Cobranças antigas ficam intocadas.

**RecurringSlot** (horário fixo) — `id, studentId, weekday (0–6), startTime ('19:00'), durationMin, mode: PRESENCIAL | ONLINE, location, meetingUrl, validFrom, validTo`

**Lesson** (cada aula de fato) — `id, teacherId, studentId, slotId?, startsAt, endsAt, status, absenceReason, justified, chargeable, priceCents (foto do preço), rescheduledFromId?, makeupCreditId?, content (o que foi dado), homework, markedAt`
- `status`: `AGENDADA | REALIZADA | FALTA_ALUNO | FALTA_PROFESSOR | CANCELADA | REMARCADA`

**MakeupCredit** (reposição) — `id, studentId, originLessonId, reason, status: ABERTO | USADO | EXPIRADO, expiresAt, usedLessonId?`

**ScheduleBlock** — `id, teacherId, startsAt, endsAt, reason ('Feriado', 'Folga')`

**Charge** (cobrança) — `id, teacherId, studentId, kind: MENSALIDADE | AULAS_DO_MES | PACOTE | AVULSA | AJUSTE, referenceMonth ('2026-10'), description, amountCents, discountCents, dueDate, canceledAt, createdAt`
- Status **calculado**: `PAGO` (pagos ≥ valor − desconto), `PARCIAL`, `ATRASADO` (vencida e com saldo), `PENDENTE`, `CANCELADO`.

**Payment** — `id, chargeId, amountCents, paidAt, method: PIX | DINHEIRO | CARTAO | TRANSFERENCIA | OUTRO, note, receiptNumber`
- `daysLate = paidAt − dueDate` (base do ranking de atrasos).

**PushSubscription** — `id, teacherId, endpoint, p256dh, auth, deviceLabel, lastSeenAt`

**NotificationLog** — `id, teacherId, type: AULA | PAGAMENTO_D1 | PAGAMENTO_ATRASO | ANIVERSARIO | RESUMO_DIARIO, refId, scheduledFor, sentAt` com índice único `(type, refId, scheduledFor)` para nunca mandar duas vezes.

**SavedFilter** — `id, teacherId, name, scope: PAGAMENTOS | AULAS | ALUNOS, criteria (jsonb), pinned`

---

## 4. Regras de negócio principais

### Geração das aulas
- Um cron diário (03:00) **materializa as próximas 8 semanas** de aulas a partir dos `RecurringSlot` ativos, pulando alunos pausados e `ScheduleBlock`.
- Ao editar um horário fixo, o app pergunta: **"Só esta aula"** ou **"Esta e as próximas"** (igual ao Google Agenda). Aulas passadas nunca mudam.
- Conflito de horário (duas aulas ao mesmo tempo) → aviso amarelo, mas não bloqueia.

### Presença e cobrança da aula

| Situação | Cobra? (padrão, editável) | Gera reposição? |
|---|---|---|
| Realizada | Sim | — |
| Falta do aluno sem justificativa | Sim | Não |
| Falta do aluno justificada | Não (configurável) | Sim (configurável) |
| Falta do professor | Não | Sim |
| Cancelada (feriado/bloqueio) | Não | Opcional |
| Remarcada | Vale a aula nova | — |

Aulas passadas ainda `AGENDADA` aparecem em **"Pendentes de marcar"** na tela Hoje, para nada ficar esquecido.

### Geração das cobranças
- **Mensal**: cron gera a cobrança do mês seguinte no dia 1 (vencimento = `dueDay`).
- **Por aula**: no fim do mês, soma das aulas `chargeable` → cobrança `AULAS_DO_MES` (o professor revisa antes de confirmar; pode ser pré-pago também).
- **Pacote**: cobrança ao vender o pacote; o saldo de aulas diminui a cada aula realizada/cobrável; aviso quando faltarem 2 aulas.
- Pagamento parcial é permitido; o saldo fica em aberto.

### Lembretes (crons)

| Cron | Frequência | O que faz |
|---|---|---|
| Lembrete de aula | a cada minuto | Aulas que começam em `lessonReminderMinutes` → push "🎵 Aula com Ana em 30 min". |
| Resumo do dia | diário, 07:00 | "Hoje: 4 aulas, 2 pagamentos vencendo". |
| Pagamento D-1 | diário, `paymentReminderHour` | Cobranças que vencem amanhã → push com botão **"Enviar lembrete no WhatsApp"**. |
| Pagamento atrasado | diário | Cobranças que venceram ontem e não foram pagas. |
| Aniversários | diário, 08:00 | Aluno que faz aniversário hoje. |
| Geração | diário, 03:00 | Aulas (8 semanas) e mensalidades. |

---

## 5. API (resumo das rotas `/v1`)

Todas protegidas por JWT, exceto login e o feed `.ics` (que usa um token secreto na URL, que pode ser trocado).

```
POST   /auth/login | /auth/refresh | /auth/logout      PATCH /auth/password
GET    /me                      PATCH /me/settings

GET    /students?status=&q=&tag=        POST /students
GET    /students/:id  (resumo: próximas aulas, saldo, frequência)
PATCH  /students/:id   POST /students/:id/pause   POST /students/:id/resume
GET    /students/:id/plans     POST /students/:id/plans  (reajuste)
GET    /students/:id/slots     POST /students/:id/slots   PATCH/DELETE /slots/:id

GET    /lessons?from=&to=&studentId=&status=      POST /lessons (avulsa)
PATCH  /lessons/:id                 (scope=this|following)
POST   /lessons/:id/attendance      { status, justified, reason, chargeable }
POST   /lessons/:id/reschedule      { startsAt }
GET    /lessons/pending-attendance
GET    /makeup-credits?status=ABERTO     POST /makeup-credits/:id/schedule
GET/POST/DELETE /schedule-blocks

GET    /charges?month=&status=&studentId=      POST /charges   PATCH /charges/:id
POST   /charges/:id/payments    DELETE /payments/:id
GET    /charges/:id/whatsapp-message
GET    /payments/:id/receipt

GET    /reports/summary?from=&to=         (recebido, previsto, em aberto, em atraso)
GET    /reports/revenue?groupBy=month|student|method
GET    /reports/late-payers?from=&to=     (ranking de atrasos)
GET    /reports/attendance?from=&to=&studentId=
GET    /reports/export.csv?type=&...filtros
GET/POST/PATCH/DELETE /saved-filters

POST   /push/subscribe   DELETE /push/subscribe   POST /push/test
GET    /calendar/:icsToken.ics       POST /calendar/rotate-token
```

### Ranking "quem mais atrasa"
Para cada aluno no período: **nº de pagamentos atrasados**, **média de dias de atraso**, **% das cobranças pagas em atraso**, **valor em atraso hoje**. Ordenação padrão por um *score* que combina frequência e média de dias, com selo visual: 🟢 em dia · 🟡 às vezes atrasa · 🔴 atrasa sempre.

### Filtros personalizados
Período (com atalhos: este mês, mês passado, últimos 3 meses, ano), alunos, tags, status, forma de pagamento, tipo de plano, faixa de valor e "somente em atraso". Os filtros ficam na URL (dá para compartilhar/voltar) e podem ser **salvos com nome** ("Inadimplentes do trimestre") e fixados como chips no topo dos relatórios.

---

## 6. Lembretes com alarme — como funciona na web (importante)

Um web app **não consegue tocar um alarme de verdade com o app fechado** como um despertador nativo. A solução combina três camadas:

1. **Web Push (principal)**: o servidor envia uma notificação push com vibração e `requireInteraction` (ela fica na tela até o professor tocar). Funciona no Android (Chrome) e no **iPhone a partir do iOS 16.4, desde que o app esteja instalado na Tela de Início**. O onboarding guia essa instalação com um passo a passo ilustrado.
2. **Calendário do celular (alarme nativo)**: o professor assina o feed `.ics` uma vez no Google Agenda ou no Calendário do iPhone. Cada aula vem com `VALARM` → o próprio celular toca o alarme, mesmo sem internet e com o app fechado. É a camada mais confiável para o "alarme".
3. **Dentro do app aberto**: banner + som suave + vibração quando a aula está chegando.

Lembrete de pagamento (D-1) vai por push para o professor, com o atalho para mandar a cobrança pronta no WhatsApp do aluno. Envio automático para o aluno (WhatsApp Business API / e-mail) fica como evolução futura, porque exige contrato e custo.

---

## 7. UX — experiência no celular

### Princípios
- **Uma mão, polegar**: navegação inferior, ações principais na metade de baixo da tela, alvos de toque ≥ 44px.
- **Marcar presença em 1 toque**: o caso mais comum (aula realizada) nunca precisa abrir um formulário.
- **Bottom sheets** em vez de modais e páginas novas; arrastar para fechar.
- **Otimista**: a interface atualiza na hora e sincroniza depois; toast com "Desfazer" em vez de "Tem certeza?".
- **Nada de tela vazia triste**: estados vazios ilustrados com uma ação clara ("Cadastre seu primeiro aluno 🌷").
- **Feedback que encanta**: vibração leve ao marcar, check animado, confete discreto quando **todos os pagamentos do mês** forem recebidos.
- **Skeletons** no carregamento, nunca spinner em tela cheia.

### Navegação

```
┌─────────────────────────────────┐
│  Boa tarde, Filipe ☀️            │
│  Terça, 22 de outubro            │
│ ┌─────────────────────────────┐ │
│ │ Hoje: 4 aulas · R$ 560 a     │ │
│ │ receber esta semana          │ │
│ └─────────────────────────────┘ │
│  Próxima aula · em 25 min        │
│ ┌─────────────────────────────┐ │
│ │ 🟣 Ana Clara   19:00–20:00  │ │
│ │ Piano · Presencial           │ │
│ │ [ ✓ Realizada ] [ Faltou ▾ ] │ │
│ └─────────────────────────────┘ │
│  ⚠️ 2 aulas pendentes de marcar  │
│  💸 Vence amanhã: Pedro R$ 280   │
│                         ( + )    │  ← FAB: aula, aluno, pagamento
├─────────────────────────────────┤
│ 🏠 Hoje  📅 Agenda  👥 Alunos  💰 Financeiro  ⋯ Mais │
└─────────────────────────────────┘
```

| Aba | Conteúdo |
|---|---|
| **Hoje** | Saudação, resumo do dia, próxima aula com contagem regressiva, aulas do dia (deslize → realizada / ← faltou), pendências de presença, vencimentos próximos. |
| **Agenda** | Faixa de dias rolável no topo + lista do dia; alternar para Semana e Mês (bolinhas com a cor de cada aluno). Tocar em um horário vazio cria uma aula ali. |
| **Alunos** | Busca + chips (Ativos, Pausados, Em atraso, tags). Ficha do aluno com abas: Resumo · Aulas · Pagamentos · Anotações. |
| **Financeiro** | Seletor de mês, anel de progresso "recebido / previsto", lista por status. Tocar em uma cobrança → sheet "Registrar pagamento" com valor e data preenchidos (2 toques). |
| **Mais** | Relatórios, Reposições, Bloqueios de agenda, Ajustes (PIX, lembretes, calendário, tema), Exportar dados. |

### Fluxos-chave (meta de toques)
- Marcar aula como realizada: **1 toque** (ou deslizar).
- Marcar falta com justificativa: **3 toques** (Faltou → "Aluno" / "Professor" → motivo rápido em chip ou texto).
- Registrar pagamento recebido: **2 toques**.
- Cobrar pelo WhatsApp: **1 toque** a partir do lembrete.
- Cadastrar aluno com horário fixo e plano: **1 tela** em etapas curtas (Dados → Horários → Plano), com valores sugeridos a partir do último aluno.

---

## 8. Design visual — "meigo", leve e bonito

Tom: delicado e acolhedor, mas legível e profissional. Cantos bem arredondados, sombras suaves, ícones com traço arredondado, um toque de emoji.

### Paleta (tokens CSS, igual ao padrão da referência)

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--background` | `#FBF8FF` | `#17131F` | Fundo lilás quase branco |
| `--card` | `#FFFFFF` | `#211C2C` | Cartões |
| `--foreground` | `#2D2640` | `#F3EEFB` | Texto principal (ameixa escuro, não preto) |
| `--muted-foreground` | `#7B7392` | `#A69FB8` | Texto secundário |
| `--primary` | `#7C6AF2` | `#9F91FF` | **Lavanda** — botões, aba ativa |
| `--primary-soft` | `#EEEAFE` | `#2C2545` | Fundos de destaque |
| `--pink` / `--pink-soft` | `#F28DB8` / `#FDE8F1` | `#F7A6C9` / `#3A2232` | **Rosa** — FAB, celebrações, aniversários |
| `--success` / `--success-soft` | `#2FB987` / `#DDF6EC` | `#4FD3A1` / `#1C3A30` | **Menta** — pago, realizada |
| `--warning` / `--warning-soft` | `#E9A23B` / `#FFF3DC` | `#F4BC66` / `#3A2F1C` | **Manteiga** — vence logo, pendente |
| `--danger` / `--danger-soft` | `#EC6A6A` / `#FDE6E6` | `#F48A8A` / `#3D2224` | **Coral** — atrasado, falta |
| `--border` | `#ECE6F7` | `#322B40` | Bordas |
| `--radius` | `1rem` (cards `1.25rem`, chips em pílula) | | |

**Cores dos alunos** (agenda e avatar): lavanda, rosa, menta, pêssego, céu, lilás, limão e coral, todas em tom pastel com texto escuro por cima (contraste AA garantido).

**Tipografia**: **Nunito** (arredondada e simpática) para títulos e números; **Inter** para o texto corrido. Valores em dinheiro com `tabular-nums`.

**Movimento**: transições de 150–250ms, sheets com mola, check de "realizada" desenhando o traço, e respeito a `prefers-reduced-motion`.

---

## 9. Segurança e confiabilidade

- Sem cadastro público: o professor é criado por seed/CLI (`pnpm api:create-teacher`).
- Senha com bcrypt; **access token** curto (15 min) na memória + **refresh token** em cookie `httpOnly`, `Secure`, `SameSite=Strict`, com rotação.
- Guards globais (JWT + Throttler) como na referência; rate limit forte no login.
- Toda consulta filtrada por `teacherId` do token (nunca por parâmetro do cliente).
- `helmet`, CSP e headers de segurança no web (copiar do `next.config.ts` da referência).
- Validação com `class-validator` na API e `zod` no formulário.
- Migrations TypeORM em produção (`synchronize` só em dev).
- Backup diário do Postgres + botão "Exportar meus dados" (JSON/CSV).
- LGPD: só os dados necessários do aluno/responsável; exclusão definitiva disponível.

---

## 10. Qualidade

- **Testes unitários (Jest)** nas regras críticas: geração de aulas, status da cobrança, cálculo de atraso, ranking, fuso horário/horário de verão.
- **E2E da API** (supertest) nos fluxos: login → aluno → aula → presença → cobrança → pagamento.
- **Playwright** no web, em viewport de celular, para os fluxos de 1–3 toques.
- Lint + typecheck no `turbo`, Husky no pre-commit (quando entrar o git).
- Lighthouse PWA/Acessibilidade ≥ 90.

---

## 11. Plano de construção (fases)

Cada fase entrega algo usável no celular.

| Fase | Entrega | Inclui |
|---|---|---|
| **0 — Fundação** ✅ | App instalável com login | Monorepo pnpm/Turbo, `docker-compose` com Postgres, API Nest (config, guards, auth, seed do professor), web Next (design tokens, fontes, app shell, navegação inferior, login, manifest/PWA), `packages/contracts`. |
| **1 — Alunos e planos** ✅ | Cadastro completo | CRUD de alunos, responsável, cores, status/pausa, planos de cobrança com histórico, lista com busca e chips, ficha do aluno. |
| **2 — Agenda e presença** ✅ | Agenda funcionando | Horários fixos, geração de aulas, visão Dia/Semana/Mês, aula avulsa, marcar presença (1 toque / deslizar), faltas com justificativa, remarcação, reposições, bloqueios, tela **Hoje**. |
| **3 — Financeiro** ✅ | Controle de mensalidades | Geração de cobranças (mensal, por aula, pacote), registrar pagamento, parcial, desconto, status calculado, mensagem de WhatsApp com PIX, recibo. |
| **4 — Lembretes** ✅ | Alarmes e avisos | Service worker, inscrição no push, onboarding "instalar no iPhone", crons (aula, D-1, atraso, resumo diário, aniversário), feed `.ics` com alarme, preferências de antecedência. |
| **5 — Relatórios** ✅ | Visão do negócio | Resumo do período, receita por mês/aluno/forma, previsto × recebido, ranking de atrasos, frequência, filtros personalizados salvos, exportar CSV. |
| **6 — Polimento e deploy** ✅ | Versão 1.0 | Modo escuro, microanimações e confete, estados vazios ilustrados, cache offline de leitura, testes E2E, Docker de produção + HTTPS, backup. |

### Contas e cadastro (implementado em 23/10/2026)
- Cadastro público por **e-mail e senha** (com confirmação de e-mail e "esqueci minha senha").
- Login com **Google**, **Microsoft (Outlook)** e **Meta (Facebook)** — detalhes e configuração em [AUTENTICACAO.md](AUTENTICACAO.md).
- **Finalizar cadastro** no perfil: nome completo, CPF (validado, único), celular, cidade/UF.

### Evoluções futuras (pós 1.0)
- **Cobrança da licença (assinatura)** com **teste grátis de 7 dias e cartão cadastrado antes** ("cancele quando quiser") — plano completo em [MONETIZACAO.md](MONETIZACAO.md).
- Envio automático de lembrete para o aluno (WhatsApp Business API / e-mail).
- Cobrança com PIX dinâmico / boleto (Asaas, Mercado Pago) e baixa automática.
- Portal simples do aluno (link sem login para ver aulas e pagar).
- Escolas com vários professores numa mesma conta (hoje cada professor tem a sua conta isolada).
- App nativo (Expo) reaproveitando `packages/contracts`, como na referência.

---

## 12. Como vai rodar (meta da Fase 0)

```
pnpm install
pnpm db:up          # Postgres no Docker
pnpm dev            # API :3200 + Web :3201
pnpm api:create-teacher   # cria o professor
```

Web: `http://localhost:3201` · Swagger: `http://localhost:3200/v1/api/docs`
(portas 3200/3201 para não conflitar com o smartreparo, que usa 3000/3001)
