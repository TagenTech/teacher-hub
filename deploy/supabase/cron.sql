-- Agenda os jobs da API (antes @Cron) no Supabase: pg_cron dispara, pg_net chama a API na Vercel.
-- Rodar UMA vez no SQL Editor do Supabase, depois do primeiro deploy da API.
-- Pré-requisito: Database → Extensions → habilitar "pg_cron" e "pg_net".
-- pg_cron usa UTC. Os horários abaixo equivalem aos de antes em America/Sao_Paulo (UTC-3).

-- 1) Segredos no Vault (troque os valores; CRON_SECRET deve ser idêntico ao da Vercel).
--    Para trocar depois: select vault.update_secret(id, 'novo-valor') from vault.secrets where name = '...';
select vault.create_secret('https://SEU-PROJETO-API.vercel.app', 'turmei_api_url');
select vault.create_secret('COLE-AQUI-O-CRON_SECRET', 'turmei_cron_secret');

-- 2) Jobs. cron.schedule com o mesmo nome substitui o agendamento existente (pode rodar de novo).
do $$
declare
  jobs text[][] := array[
    ['turmei-reminders',      '* * * * *',  'reminders'],       -- lembretes: a cada minuto
    ['turmei-pauses',         '0 * * * *',  'pauses'],          -- fim de pausas: de hora em hora
    ['turmei-slots',          '0 6 * * *',  'slots'],           -- 03:00 BRT: gera aulas recorrentes
    ['turmei-billing',        '0 7 * * *',  'billing'],         -- 04:00 BRT: gera mensalidades
    ['turmei-security-prune', '0 8 * * *',  'security-prune']   -- 05:00 BRT: limpa eventos de segurança
  ];
  j text[];
begin
  foreach j slice 1 in array jobs loop
    perform cron.schedule(j[1], j[2], format($cmd$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'turmei_api_url') || '/v1/internal/jobs/%s',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'turmei_cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      )
    $cmd$, j[3]));
  end loop;
end $$;

-- 3) Conferir:
--   select jobname, schedule, active from cron.job where jobname like 'turmei-%';
--   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 20;
--   select status_code, content, created from net._http_response order by created desc limit 20;
-- Desligar um job: select cron.unschedule('turmei-reminders');
