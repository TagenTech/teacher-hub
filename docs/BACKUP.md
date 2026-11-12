# Backup e restauração do banco

O Postgres de produção fica no Supabase (plano free, sem backup automático).
Enquanto não houver plano pago, o backup é feito por workflow do GitHub Actions.

## Como funciona

- `.github/workflows/backup.yml` roda todo dia às **03:53 (horário de Brasília)**
  (e pode ser disparado à mão em **Actions → Backup do banco → Run workflow**).
- O job faz `pg_dump` do banco inteiro, compacta com gzip e criptografa com
  AES-256 (`openssl enc -aes-256-cbc -pbkdf2`).
- O arquivo `turmei-AAAA-MM-DD_HHMM.sql.gz.enc` vai para a branch **`backups`**
  do próprio repositório (privado). Arquivos com mais de **45 dias** são apagados.
- A branch `backups` não dispara deploy nem migrations (os workflows só rodam na `main`).
- Segredos usados (em **Settings → Secrets and variables → Actions**):
  - `DATABASE_URL` — conexão com o banco (pooler do Supabase, porta 5432);
  - `BACKUP_PASSPHRASE` — senha da criptografia. **Sem ela o backup não abre.**
    Ela fica visível para quem administra o repositório; guarde uma cópia em
    local seguro (gerenciador de senhas).

## Monitoramento

`.github/workflows/monitor.yml` roda a cada 30 min e confere site, API e banco.
Se algo falhar, o GitHub envia e-mail de falha do workflow para quem administra
o repositório. Para alertas mais rápidos (5 min), a alternativa gratuita é o
UptimeRobot ou um Worker da Cloudflare.

## Como restaurar um backup

1. Baixe o arquivo `.enc` da branch `backups` (GitHub → branch `backups`).
2. Descriptografe (troque `<senha>` pela `BACKUP_PASSPHRASE`):

   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -in turmei-AAAA-MM-DD_HHMM.sql.gz.enc -out dump.sql.gz -pass pass:<senha>
   gunzip dump.sql.gz
   ```

3. Valide antes de aplicar: `grep -c 'CREATE TABLE' dump.sql`.
4. Restaure no banco (⚠️ pode conflitar com objetos existentes — o dump é
   `--no-owner --no-privileges`, então tabelas voltam com o dono de quem restaura):

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f dump.sql
   ```

5. Se o banco foi recriado do zero, rode as migrations pendentes:
   `pnpm --filter @turmei/api migration:run` (ou suba a API com
   `TYPEORM_MIGRATIONS_RUN=true`).

## Limites do plano free

- Histórico de **45 dias** de dumps diários.
- Se um dia o banco passar de ~2 GB, o dump pode demorar mais que o limite do
  job do Actions; aí o caminho é o backup nativo do Supabase (plano Pro) ou
  pgBackRest em VPS dedicada.
