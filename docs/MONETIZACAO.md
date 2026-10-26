# Evolução futura: cobrança da licença (assinatura)

Status: **planejado — não implementado.** Hoje o uso é gratuito. Este documento define como cobrar depois,
sem retrabalho: o cadastro (e-mail + CPF + celular) e o isolamento por professor já estão prontos.

## Modelo proposto

| Item | Proposta |
|---|---|
| Produto | Licença mensal por professor (plano único no início) |
| Preço | A definir (ex.: R$ 29,90/mês; anual com ~2 meses grátis) |
| **Teste grátis** | **7 dias, com cartão cadastrado antes** ("teste 7 dias grátis, cancele quando quiser") |
| Cobrança | Automática no 8º dia, depois a cada mês, no cartão |
| Cancelamento | A qualquer momento, pelo app, em 2 toques; acesso continua até o fim do período já pago |
| Inadimplência | 3 novas tentativas em ~7 dias; depois, modo leitura (dados preservados) |
| Contas atuais | Quem já usa ganha período de cortesia (ex.: 30 dias) e aviso com antecedência |

### Por que cartão no teste
Aumenta a conversão e filtra cadastros sem intenção. Contrapartidas obrigatórias: deixar claro **antes** do
cadastro do cartão a data da primeira cobrança e o valor; avisar por e-mail/push **2 dias antes** do fim do
teste; cancelar sem atrito. (Código de Defesa do Consumidor: informação clara, sem cobrança surpresa.)

## Fluxo do usuário

```
Cadastro (e-mail/Google/…) → usa grátis como hoje
        │
        ▼ (quando a cobrança for ligada)
Tela "Ative seu teste de 7 dias" → finalizar cadastro (CPF já coletado) → cartão
        │   "Hoje: R$ 0,00 · Em 30/10: R$ 29,90/mês · Cancele quando quiser"
        ▼
TRIAL (7 dias, acesso completo) ── aviso D-2 ──▶ cobrança automática
        │                                            │
   cancelou ▶ CANCELED (acesso até fim do trial)     ├─ aprovada ▶ ACTIVE
                                                     └─ recusada ▶ PAST_DUE ─ retentativas ─▶ ACTIVE / SUSPENDED
```

## Máquina de estados da assinatura

| Estado | Acesso | Entra quando |
|---|---|---|
| `NONE` | completo (fase gratuita) / bloqueado após o lançamento | conta criada |
| `TRIALING` | completo | cartão cadastrado, teste iniciado |
| `ACTIVE` | completo | pagamento aprovado |
| `PAST_DUE` | completo + aviso | cobrança recusada (retentativas em andamento) |
| `CANCELED` | completo até `currentPeriodEnd` | usuário cancelou |
| `SUSPENDED` | **somente leitura** + exportar dados | retentativas esgotadas ou fim do período cancelado |

Regra: **nunca apagar dados** por falta de pagamento; somente leitura + exportação (LGPD e confiança).

## Gateway de pagamento (Brasil)

| Gateway | Assinatura com trial | Cartão + PIX | Observações |
|---|---|---|---|
| **Asaas** | Sim | Sim (+ boleto) | Bom para PF/MEI, emite nota fiscal de serviço, API simples |
| **Mercado Pago** | Sim (preapproval) | Sim | Marca conhecida, checkout transparente |
| **Pagar.me (Stone)** | Sim | Sim | Robusto, tarifas negociáveis |
| **Stripe** | Sim (trial nativo) | Cartão; PIX em evolução | Melhor DX e portal do cliente pronto |

Recomendação inicial: **Asaas** (assinatura + nota fiscal + PIX num só lugar) ou **Stripe** (se o foco for
cartão e experiência de checkout/portal prontos). Nunca guardar número de cartão no nosso banco: só o
`customerId`/`subscriptionId` do gateway (tokenização → fora do escopo PCI).

## O que implementar (quando for a hora)

### Dados
```
subscriptions
  id, teacher_id (unique), gateway, gateway_customer_id, gateway_subscription_id,
  status (NONE|TRIALING|ACTIVE|PAST_DUE|CANCELED|SUSPENDED),
  plan_code, price_cents, trial_ends_at, current_period_end, cancel_at_period_end,
  canceled_at, created_at, updated_at
subscription_events   -- auditoria e idempotência dos webhooks
  id, gateway_event_id (unique), type, payload jsonb, processed_at
```

### API
- `POST /billing/checkout` → cria cliente (nome, e-mail, **CPF**, celular — já coletados no "Finalizar cadastro") e a assinatura com trial de 7 dias; devolve a URL/SDK de cartão do gateway.
- `GET /billing/subscription` → estado atual, data da próxima cobrança, valor.
- `POST /billing/cancel` (fim do período) e `POST /billing/resume`.
- `POST /billing/webhook/:gateway` (público, **assinatura verificada**, idempotente por `gateway_event_id`).
- Guard global `SubscriptionGuard`: em `SUSPENDED`, só `GET` e exportação.
- Crons: aviso D-2 do fim do trial; aviso de cartão expirando; e-mail de recibo.

### Web
- Banner/tela "Ative seu teste grátis" com o resumo da cobrança antes do cartão.
- Mais → **Assinatura**: plano, próxima cobrança, trocar cartão (portal do gateway), cancelar, recibos/notas.
- Modo leitura amigável em `SUSPENDED` ("Seus dados estão salvos. Reative para voltar a editar.").

### Legal e fiscal
- Termos com cláusula de assinatura, teste, renovação automática e cancelamento.
- Emissão de NFS-e (o gateway pode emitir) — definir CNAE/regime tributário com contador.
- Política de reembolso (sugestão: proporcional nos primeiros 7 dias após a 1ª cobrança).

### Métricas
Conversão cadastro → teste → pago, churn mensal, MRR, motivos de cancelamento (perguntar no fluxo de cancelar).
O acompanhamento fica no painel de admin descrito em [Painel financeiro das licenças](#painel-financeiro-das-licenças-admin--planejado).

## Painel financeiro das licenças (admin) — planejado

Status: **planejado — não implementado** (depende da cobrança da licença acima). Serve para o dono do Turmei
acompanhar o **dinheiro do próprio Turmei**: assinaturas, receita recorrente, testes grátis e cancelamentos.

### O que é (e o que nunca é)
| Entra | Fica de fora, sempre |
|---|---|
| Pagamentos **das licenças** (professor → Turmei), vindos das tabelas `subscriptions` e `subscription_events` e do gateway | Cobranças e pagamentos que o professor faz **aos seus alunos** (tabelas `charges`/`payments`), valores, PIX do professor |
| Estado da assinatura, datas e valor do plano | Número de cartão, CVV, `payload` bruto dos webhooks (só o gateway guarda dados de cartão) |

Motivo: os recebimentos dos alunos são dados do professor e de terceiros; o Turmei é operador desses dados (LGPD) e
**não tem finalidade legítima para olhá-los**. O painel atual de usuários já foi feito assim: nem consulta essas tabelas.

### Onde vive
Uma seção nova no **painel offline** (`scripts/painel-usuarios/`), com as mesmas garantias: gerado por script,
**somente leitura**, **só banco local** (produção via cópia restaurada ou `--allow-remote` consciente),
arquivo em `.local/` (ignorado pelo git). Ela lê apenas colunas escolhidas de `subscriptions` e
`subscription_events` (**nunca** a coluna `payload`). Sem aplicação web de admin dentro do app: um painel de admin
exposto em produção é superfície de ataque a mais; o offline não tem esse risco.

### Indicadores
| Indicador | Definição |
|---|---|
| **Assinaturas por estado** | contagem em `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED` (com acesso até o fim do período), `SUSPENDED` |
| **MRR** | soma do valor mensal das assinaturas `ACTIVE` e `PAST_DUE`; plano anual entra como valor ÷ 12; cortesia/cupom de 100% entra com R$ 0; **trial não conta** até a 1ª cobrança aprovada |
| **ARR** | MRR × 12 |
| **ARPU** | MRR ÷ assinaturas pagantes |
| **Funil de conversão** | cadastro → iniciou trial → 1ª cobrança aprovada, com % em cada etapa |
| **Trials** | em andamento, terminam em 2 dias (alinha com o aviso D-2), convertidos e cancelados antes de cobrar, no mês |
| **Churn de clientes** | assinaturas que passaram a `SUSPENDED`/cancelaram no mês ÷ pagantes no início do mês |
| **Churn de receita** | MRR perdido no mês ÷ MRR do início do mês |
| **Movimento do MRR** | novo + reativado − cancelado − contração (cupom/queda de plano), calculado a partir de `subscription_events` |
| **Inadimplência** | assinaturas em `PAST_DUE`, valor em risco, tentativas restantes, recuperadas no mês |
| **Retenção por coorte** | % de pagantes ainda ativos 1, 3, 6 e 12 meses depois do mês de início |
| **Motivos de cancelamento** | contagem das respostas do fluxo de cancelar (campo já previsto em "Métricas") |

### Na tabela de usuários
Uma coluna **Assinatura** (selo do estado + data do fim do trial ou da próxima cobrança + valor do plano) e,
na gaveta de detalhes, o histórico dos eventos da assinatura (início do teste, cobrança aprovada/recusada,
cancelamento) **sem** dados de cartão. O filtro rápido ganha "Trial acabando", "Em atraso (licença)" e "Cancelaram".

### Como construir (quando a cobrança existir)
1. Criar `subscriptions` e `subscription_events` conforme a seção "Dados" acima (com valores em centavos).
2. Estender `gerar.mjs` com consultas só de leitura nessas duas tabelas (colunas explícitas, nada de `SELECT *`)
   e um bloco `license` no JSON do painel; a tela só mostra a seção se o bloco existir (painel antigo continua funcionando).
3. Calcular o movimento do MRR a partir dos eventos idempotentes dos webhooks, não do estado atual (para ter histórico).
4. **Conferir com o relatório do gateway** uma vez por mês: o MRR do painel precisa bater com a receita do gateway;
   diferença grande indica webhook perdido.
5. Testes: dados de exemplo (`--demo`) com assinaturas em todos os estados e um teste que garante que
   o JSON gerado não contém `payload`, número de cartão nem nada de `charges`/`payments`.

### Cuidados
- Reembolsos e *chargebacks* reduzem a receita do mês: registrar como evento próprio.
- Moeda sempre em centavos (como no resto do app); datas em `YYYY-MM-DD` no fuso do Brasil.
- Quem usa a fase gratuita ou a cortesia aparece como `NONE`/R$ 0 e não entra no MRR.
- O arquivo gerado tem dados pessoais e financeiros do Turmei: guardar em `.local/`, não anexar em chats nem e-mail.

## Checklist de lançamento
- [ ] Gateway escolhido, conta PJ/MEI aprovada, webhooks configurados em produção
- [ ] Termos/Privacidade revisados por jurídico
- [ ] E-mails transacionais (início do teste, D-2, cobrança aprovada/recusada, cancelamento)
- [ ] Período de cortesia para quem já usa + comunicado
- [ ] Testes ponta a ponta no sandbox do gateway (aprovado, recusado, cancelado, reativado)
