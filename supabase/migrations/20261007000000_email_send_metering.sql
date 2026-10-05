-- Counts transactional emails sent through Resend, so the platform infra-costs panel
-- can show usage against Resend's free-tier cap. Only the template name and a timestamp
-- are stored -- never a recipient address.

create table if not exists public.email_send_events (
  id uuid primary key default gen_random_uuid(),
  template text not null,
  sent_at timestamptz not null default now()
);

alter table public.email_send_events enable row level security;

create policy email_send_events_platform_read on public.email_send_events
  for select to authenticated
  using (public.is_platform_admin());

-- No insert/update/delete policy: rows are written only by the service role from
-- server code (src/lib/email.ts), after a successful provider response.
grant select on public.email_send_events to authenticated;
grant select, insert on public.email_send_events to service_role;

create or replace function public.run_monthly_infra_snapshot()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_period_start date := date_trunc('month', now())::date;
  v_period_end date := (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date;
  v_db_bytes bigint;
  v_storage_bytes bigint;
  v_mau integer;
  v_r2_bytes bigint;
  v_emails integer;
begin
  select pg_database_size(current_database()) into v_db_bytes;
  select coalesce(sum((metadata->>'size')::bigint), 0) into v_storage_bytes from storage.objects;
  select count(*) into v_mau from auth.users where last_sign_in_at >= v_period_start::timestamptz;
  select coalesce(sum(size_bytes), 0) into v_r2_bytes from public.org_storage_events;
  select count(*) into v_emails from public.email_send_events where sent_at >= v_period_start::timestamptz;

  perform public.record_platform_infra_metric_system('supabase_db_size_gb', v_db_bytes / (1024.0*1024*1024), 'GB', v_period_start, v_period_end);
  perform public.record_platform_infra_metric_system('supabase_storage_gb', v_storage_bytes / (1024.0*1024*1024), 'GB', v_period_start, v_period_end);
  perform public.record_platform_infra_metric_system('supabase_auth_mau', v_mau, 'MAU', v_period_start, v_period_end);
  perform public.record_platform_infra_metric_system('r2_storage_gb', v_r2_bytes / (1024.0*1024*1024), 'GB', v_period_start, v_period_end);
  perform public.record_platform_infra_metric_system('resend_emails_month', v_emails, 'emails', v_period_start, v_period_end);
end
$function$;
