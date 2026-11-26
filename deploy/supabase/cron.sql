-- Agenda os jobs da API (antes @Cron) no Supabase: pg_cron dispara, pg_net chama a API na Vercel.
-- Rodar UMA vez no SQL Editor do Supabase, depois do primeiro deploy da API.
-- Pré-requisito: Database → Extensions → habilitar "pg_cron" e "pg_net".
-- pg_cron usa UTC. Os horários abaixo equivalem aos de antes em America/Sao_Paulo (UTC-3).

-- 1) Segredos no Vault (troque os valores; CRON_SECRET deve ser idêntico ao da Vercel).
--    Pode rodar de novo para trocar os valores.
do $$
declare
  secrets text[][] := array[
    ['turmei_api_url',     'https://SEU-PROJETO-API.vercel.app'],
    ['turmei_cron_secret', 'COLE-AQUI-O-CRON_SECRET']
  ];
  s text[];
  existing uuid;
begin
  foreach s slice 1 in array secrets loop
    select id into existing from vault.secrets where name = s[1];
    if existing is null then
      perform vault.create_secret(s[2], s[1]);
    else
      perform vault.update_secret(existing, s[2]);
    end if;
  end loop;
end $$;

-- 2) Jobs. cron.schedule com o mesmo nome substitui o agendamento existente (pode rodar de novo).
--    turmei-reminders: o SQL roda a cada minuto, mas só chama a API quando existe
--    aula AGENDADA dentro da janela de lembrete de algum professor (WHERE EXISTS).
--    Isso derruba ~43k chamadas/mês → poucas centenas, sem perder a precisão
--    de minuto dos lembretes de aula (o maior consumidor de CPU da Vercel).
do $$
begin
  perform cron.schedule('turmei-reminders', '* * * * *', $cmd$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'turmei_api_url') || '/v1/internal/jobs/reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'turmei_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    )
    where exists (
      select 1
      from turmei_lessons l
      join turmei_teachers t on t.id = l.teacher_id
      where l.status = 'AGENDADA'
        and t.lesson_reminder_minutes > 0
        and l.starts_at > now()
        and l.starts_at <= now() + (t.lesson_reminder_minutes || ' minutes')::interval
    )
  $cmd$);
end $$;

--    turmei-reminders-daily: a cada 5 min, incondicional. Cobre as notificações
--    por janela de horário (resumo 7h, pagamentos, aniversários 8h), é rede de
--    segurança para os lembretes de aula (idempotente) e MANTÉM a function
--    quente — chamadas quentes custam ~66ms de CPU contra ~2,5s de cold start.
do $$
declare
  jobs text[][] := array[
    ['turmei-reminders-daily', '*/5 * * * *', 'reminders'],     -- resumo/pagamento/aniversário + fallback + keep-warm
    ['turmei-pauses',         '0 * * * *',  'pauses'],          -- fim de pausas: de hora em hora
    ['turmei-slots',          '0 6 * * *',  'slots'],           -- 03:00 BRT: gera aulas recorrentes
    ['turmei-billing',        '0 7 * * *',  'billing'],         -- 04:00 BRT: gera mensalidades
    ['turmei-security-prune', '0 8 * * *',  'security-prune'],  -- 05:00 BRT: limpa eventos de segurança
    ['turmei-tagen-heartbeat', '17 */6 * * *', 'tagen-heartbeat'] -- a cada 6h: sinal de vida p/ o backoffice
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
