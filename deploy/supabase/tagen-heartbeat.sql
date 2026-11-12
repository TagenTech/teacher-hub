-- Agenda SOMENTE o heartbeat da integração Tagen (os demais jobs já estão em
-- deploy/supabase/cron.sql). Idempotente: pode rodar de novo.
-- Lê a URL da API e o CRON_SECRET do Vault (preenchidos no passo 1 do cron.sql);
-- se o Vault ainda não tiver os segredos, falha com aviso em vez de agendar quebrado.
do $$
declare
  api_url text;
  cron_secret text;
begin
  select decrypted_secret into api_url from vault.decrypted_secrets where name = 'turmei_api_url';
  select decrypted_secret into cron_secret from vault.decrypted_secrets where name = 'turmei_cron_secret';
  if api_url is null or cron_secret is null then
    raise exception 'Vault sem turmei_api_url/turmei_cron_secret — rode deploy/supabase/cron.sql passo 1 antes';
  end if;
  begin
    perform cron.unschedule('turmei-tagen-heartbeat');
  exception when others then
    null; -- o job ainda não existia
  end;
  perform cron.schedule('turmei-tagen-heartbeat', '17 */6 * * *', format($cmd$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'turmei_api_url') || '/v1/internal/jobs/tagen-heartbeat',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'turmei_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    )
  $cmd$));
end $$;

-- Conferir: select jobname, schedule, active from cron.job where jobname = 'turmei-tagen-heartbeat';
