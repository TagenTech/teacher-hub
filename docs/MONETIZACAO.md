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

## Checklist de lançamento
- [ ] Gateway escolhido, conta PJ/MEI aprovada, webhooks configurados em produção
- [ ] Termos/Privacidade revisados por jurídico
- [ ] E-mails transacionais (início do teste, D-2, cobrança aprovada/recusada, cancelamento)
- [ ] Período de cortesia para quem já usa + comunicado
- [ ] Testes ponta a ponta no sandbox do gateway (aprovado, recusado, cancelado, reativado)
