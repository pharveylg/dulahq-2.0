-- Infra cost visibility (2026-09-29), a different concern from the customer-facing
-- billing_usage_meters catalog (phase16e): that tracks what each ORG uses against
-- ITS plan; this tracks what running Dula HQ itself actually costs, platform-wide,
-- not attributable to one tenant.
--
-- User's own scoping, asked directly:
--   - Cover Supabase + R2 (this app's real infra) + note Vercel is NOT covered --
--     no in-app data source can approximate its bandwidth/compute, and neither
--     Vercel's usage API nor Supabase's Management API (both need a NEW access
--     token, not the project's existing anon/service-role/R2 keys) were wanted
--     for this pass. Everything recorded here comes from data already queryable
--     inside this Postgres database.
--   - Platform-wide total, not per-org -- most of it (DB size, Supabase Storage,
--     auth MAU) genuinely isn't attributable to one tenant's traffic.
--
-- Four real, exact-or-well-approximated metrics, all computable with zero new
-- credentials:
--   - supabase_db_size_gb: pg_database_size(current_database()) -- exact.
--   - supabase_storage_gb: sum(storage.objects.metadata->>'size') -- exact.
--   - supabase_auth_mau: count of auth.users with last_sign_in_at in the current
--     month -- an approximation of Supabase's own MAU billing metric (a real
--     authenticated request is the precise trigger; a sign-in is a reasonable,
--     documented proxy, not identical).
--   - r2_storage_gb: sum(org_storage_events.size_bytes) across every org (the
--     ledger phase16e already built, just aggregated with no org_id filter for
--     the platform total instead of one org's figure).
create table public.platform_infra_metrics (
  id bigint generated always as identity primary key,
  metric_key text not null,
  value numeric not null,
  unit text not null,
  recorded_at timestamptz not null default now(),
  period_start date not null,
  period_end date not null,
  unique (metric_key, period_start, period_end)
);

alter table public.platform_infra_metrics enable row level security;

create policy platform_infra_metrics_read on public.platform_infra_metrics for select to authenticated
using (public.is_platform_admin());

-- No insert/update/delete policy for anyone -- written only by the functions below.

create or replace function public.record_platform_infra_metric_system(p_metric_key text, p_value numeric, p_unit text, p_period_start date, p_period_end date)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.platform_infra_metrics(metric_key, value, unit, period_start, period_end)
  values (p_metric_key, p_value, p_unit, p_period_start, p_period_end)
  on conflict (metric_key, period_start, period_end)
  do update set value = excluded.value, recorded_at = now();
end $$;

revoke all on function public.record_platform_infra_metric_system(text, numeric, text, date, date) from public, anon, authenticated;
grant execute on function public.record_platform_infra_metric_system(text, numeric, text, date, date) to service_role;

create or replace function public.run_monthly_infra_snapshot()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_period_start date := date_trunc('month', now())::date;
  v_period_end date := (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date;
  v_db_bytes bigint;
  v_storage_bytes bigint;
  v_mau integer;
  v_r2_bytes bigint;
begin
  select pg_database_size(current_database()) into v_db_bytes;
  select coalesce(sum((metadata->>'size')::bigint), 0) into v_storage_bytes from storage.objects;
  select count(*) into v_mau from auth.users where last_sign_in_at >= v_period_start::timestamptz;
  select coalesce(sum(size_bytes), 0) into v_r2_bytes from public.org_storage_events;

  perform public.record_platform_infra_metric_system('supabase_db_size_gb', v_db_bytes / (1024.0*1024*1024), 'GB', v_period_start, v_period_end);
  perform public.record_platform_infra_metric_system('supabase_storage_gb', v_storage_bytes / (1024.0*1024*1024), 'GB', v_period_start, v_period_end);
  perform public.record_platform_infra_metric_system('supabase_auth_mau', v_mau, 'MAU', v_period_start, v_period_end);
  perform public.record_platform_infra_metric_system('r2_storage_gb', v_r2_bytes / (1024.0*1024*1024), 'GB', v_period_start, v_period_end);
end $$;

revoke all on function public.run_monthly_infra_snapshot() from public, anon, authenticated;
grant execute on function public.run_monthly_infra_snapshot() to service_role;

select cron.schedule('monthly-infra-snapshot', '15 1 1 * *', $$select public.run_monthly_infra_snapshot()$$);
