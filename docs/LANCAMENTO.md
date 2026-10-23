# Checklist de lançamento

O código está pronto e testado (`pnpm test`, e2e da API e Playwright no CI). Este é o passo a passo do que
depende de você para colocar no ar. Marque conforme for fazendo.

> **Mínimo para lançar:** seções 1, 2 e 3 (Resend). O resto pode vir depois.

## 1. Chaves e segredos

Tudo vai no `.env.prod` **do servidor** (modelo em [`.env.prod.example`](../.env.prod.example)). Nunca no git.

| Variável | Como gerar | Se perder… |
|---|---|---|
| `DATA_ENCRYPTION_KEY` | `openssl rand -base64 32` | **os CPFs e a 2FA ficam ilegíveis.** Guarde num cofre (1Password, Bitwarden) |
| `BACKUP_PASSPHRASE` | `openssl rand -base64 32` | **não dá para restaurar backups.** Guarde fora do servidor |
| `JWT_SECRET` | `openssl rand -base64 48` | todos precisam entrar de novo (sem perda de dados) |
| `POSTGRES_PASSWORD` | `openssl rand -base64 24` | — |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` | aparelhos precisam reativar os lembretes |

- [ ] Gerei as chaves e guardei `DATA_ENCRYPTION_KEY` e `BACKUP_PASSPHRASE` num cofre
- [ ] `.env.prod` no servidor com permissão `600` (`chmod 600 .env.prod`)
- [ ] Vazou alguma? Troque todas — apagar o arquivo não basta (ver [SEGURANCA.md](SEGURANCA.md))

## 2. Servidor e domínio

- [ ] VPS com Docker (2 GB de RAM bastam no início)
- [ ] Domínio registrado, com registro DNS `A` apontando para o IP do servidor
- [ ] `DOMAIN=` no `.env.prod` — o Caddy emite o HTTPS sozinho (Let's Encrypt)
- [ ] Subir: ver [README → Produção](../README.md#produção-docker)
- [ ] Criar sua conta: `docker compose … exec api node dist/scripts/create-teacher.js …` (ou pelo cadastro público)
- [ ] Backups: o container já faz um por dia, cifrado, em `./backups`. **Copie para fora do servidor** (S3, Backblaze, Google Drive)
- [ ] Testar a restauração de um backup uma vez (comando no README)
- [ ] Opcional: `SENTRY_DSN` para ser avisado de erros, com alerta para picos de erro 5xx

## 3. Serviços externos

- [ ] **Resend** (e-mail de confirmação e "esqueci a senha"): criar conta, verificar o domínio, `RESEND_API_KEY` e `MAIL_FROM`.
      Sem ele os e-mails não saem em produção.
- [ ] **Login social** (opcional; sem as chaves os botões somem e fica só e-mail/senha):
      Google, Microsoft e Meta — passo a passo em [AUTENTICACAO.md](AUTENTICACAO.md#configurar-cada-provedor)

## 4. Legal (LGPD)

- [ ] Revisar `/termos` e `/privacidade` com assessoria jurídica — hoje são rascunho (`apps/web/src/app/termos`, `.../privacidade`)
- [ ] Indicar um contato para pedidos de titulares (e-mail no rodapé da política)
- [ ] O app já tem: exportar dados (Mais → Meus dados), excluir conta, CPF cifrado

## 5. GitHub

- [ ] **CodeQL**: em repositório privado exige o GitHub Code Security (pago para organizações). Hoje o job é pulado.
      Para ligar: tornar o repositório público **ou** ativar o Code Security e criar a variável
      `CODEQL_ENABLED=true` em *Settings → Secrets and variables → Actions → Variables*.
- [ ] Proteger a `main`: *Settings → Branches → Add rule* → exigir o check **CI / qualidade** e PR antes do merge
- [ ] Dependabot: revisar os PRs semanais. Prefira versões LTS do Node (22, 24) — recuse versões ímpares (23, 25)

## 6. Depois do lançamento

- [ ] Cobrança da licença (teste grátis de 7 dias com cartão): plano em [MONETIZACAO.md](MONETIZACAO.md)
- [ ] Revisão de dependências mensal e restauração de backup trimestral
- [ ] Pentest externo antes de escalar
