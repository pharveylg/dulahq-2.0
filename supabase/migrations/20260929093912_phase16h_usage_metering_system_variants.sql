-- phase16f/16g's service_role-JWT check was the wrong fix: pg_cron's actual
-- scheduled execution carries no JWT at all (unlike a genuine service-role
-- API call), so it doesn't satisfy "auth.jwt()->>'role' = 'service_role'"
-- either -- caught by re-running the manual test after 16f/16g and getting
-- the SAME failure from a different line. The real, established fix for
-- "a trusted internal caller needs to invoke a normally-checked function" is
-- already in this codebase: write_audit/write_audit_system's split (§0p).
-- Same pattern here: record_billing_usage_event/snapshot_billing_usage_period
-- keep their existing checks (correct for their real direct callers -- e.g.
-- addEntry calling record_billing_usage_event as the signed-in organizer),
-- and gain unchecked "_system" twins that run_monthly_usage_snapshot() --
-- itself already the trusted gate, EXECUTE locked to service_role -- calls
-- directly instead of re-authorizing through the checked wrapper a second
-- time in a context with no auth.uid() to check.

create or replace function public.record_billing_usage_event_system(p_org_id uuid, p_meter_key text, p_context_type text, p_context_id uuid DEFAULT NULL::uuid, p_quantity numeric DEFAULT 0, p_source_type text DEFAULT NULL::text, p_source_id text DEFAULT NULL::text, p_occurred_at timestamp with time zone DEFAULT now(), p_idempotency_key text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id bigint;
  v_meter public.billing_usage_meters%rowtype;
begin
  select * into v_meter from public.billing_usage_meters where key = p_meter_key and active;
  if not found then raise exception 'active usage meter not found' using errcode = 'no_data_found'; end if;
  if p_quantity < 0 then raise exception 'usage quantity cannot be negative' using errcode = 'check_violation'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency key is required' using errcode = 'check_violation';
  end if;

  insert into public.billing_usage_events(
    org_id, meter_key, context_type, context_id, quantity,
    source_type, source_id, occurred_at, idempotency_key
  ) values (
    p_org_id, p_meter_key, p_context_type, p_context_id, p_quantity,
    p_source_type, p_source_id, p_occurred_at, trim(p_idempotency_key)
  ) on conflict (idempotency_key) do nothing returning id into v_id;

  if v_id is null then
    select id into v_id from public.billing_usage_events where idempotency_key = trim(p_idempotency_key);
  end if;
  return v_id;
end $function$;

revoke all on function public.record_billing_usage_event_system(uuid, text, text, uuid, numeric, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.record_billing_usage_event_system(uuid, text, text, uuid, numeric, text, text, timestamptz, text) to service_role;

create or replace function public.record_billing_usage_event(p_org_id uuid, p_meter_key text, p_context_type text, p_context_id uuid DEFAULT NULL::uuid, p_quantity numeric DEFAULT 0, p_source_type text DEFAULT NULL::text, p_source_id text DEFAULT NULL::text, p_occurred_at timestamp with time zone DEFAULT now(), p_idempotency_key text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_platform_admin()
    or public.is_org_member(p_org_id)
  ) then
    raise exception 'not authorized to record usage for this organization' using errcode = 'insufficient_privilege';
  end if;
  return public.record_billing_usage_event_system(p_org_id, p_meter_key, p_context_type, p_context_id, p_quantity, p_source_type, p_source_id, p_occurred_at, p_idempotency_key);
end $function$;

create or replace function public.snapshot_billing_usage_period_system(p_org_id uuid, p_meter_key text, p_period_start date, p_period_end date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_quantity numeric(12,3);
begin
  if p_period_end < p_period_start then raise exception 'period end must not precede period start' using errcode = 'check_violation'; end if;

  select coalesce(sum(quantity), 0)::numeric(12,3) into v_quantity
    from public.billing_usage_events
   where org_id = p_org_id
     and meter_key = p_meter_key
     and occurred_at >= p_period_start::timestamptz
     and occurred_at < (p_period_end + 1)::timestamptz;

  insert into public.billing_usage_periods(org_id, meter_key, period_start, period_end, quantity, status)
  values (p_org_id, p_meter_key, p_period_start, p_period_end, v_quantity, 'projected')
  on conflict (org_id, meter_key, period_start, period_end)
  do update set quantity = excluded.quantity, status = case when billing_usage_periods.status = 'locked' then 'locked' else 'projected' end, updated_at = now()
  returning id into v_id;

  return v_id;
end $function$;

revoke all on function public.snapshot_billing_usage_period_system(uuid, text, date, date) from public, anon, authenticated;
grant execute on function public.snapshot_billing_usage_period_system(uuid, text, date, date) to service_role;

create or replace function public.snapshot_billing_usage_period(p_org_id uuid, p_meter_key text, p_period_start date, p_period_end date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_platform_admin()
    or public.is_org_member(p_org_id)
  ) then
    raise exception 'not authorized to snapshot usage for this organization' using errcode = 'insufficient_privilege';
  end if;
  return public.snapshot_billing_usage_period_system(p_org_id, p_meter_key, p_period_start, p_period_end);
end $function$;

-- run_monthly_usage_snapshot() itself is the trusted gate now -- call the
-- unchecked twins directly instead of re-authorizing through the checked
-- wrapper a second time.
create or replace function public.run_monthly_usage_snapshot()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org record;
  v_period_start date := date_trunc('month', now())::date;
  v_period_end date := (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date;
  v_month_key text := to_char(now(), 'YYYY-MM');
  v_clubs numeric; v_players numeric; v_teams numeric; v_seats numeric; v_storage numeric;
begin
  for v_org in select id from public.organizations where status = 'active' loop
    select count(*) into v_clubs from public.clubs where org_id = v_org.id;
    select count(*) into v_players from public.players where org_id = v_org.id;
    select count(*) into v_teams from public.teams where org_id = v_org.id;
    select
      (select count(*) from public.club_staff where org_id = v_org.id and status = 'active')
      + (select count(*) from public.tournament_staff where org_id = v_org.id and status = 'active')
    into v_seats;
    select coalesce(sum(size_bytes), 0) / (1024.0*1024*1024) into v_storage
      from public.org_storage_events where org_id = v_org.id;

    perform public.record_billing_usage_event_system(v_org.id, 'active_clubs_monthly', 'organization', v_org.id, v_clubs, 'monthly_snapshot', null, now(), v_org.id::text || ':active_clubs_monthly:' || v_month_key);
    perform public.record_billing_usage_event_system(v_org.id, 'active_players_monthly', 'organization', v_org.id, v_players, 'monthly_snapshot', null, now(), v_org.id::text || ':active_players_monthly:' || v_month_key);
    perform public.record_billing_usage_event_system(v_org.id, 'active_teams_monthly', 'organization', v_org.id, v_teams, 'monthly_snapshot', null, now(), v_org.id::text || ':active_teams_monthly:' || v_month_key);
    perform public.record_billing_usage_event_system(v_org.id, 'active_staff_seats_monthly', 'organization', v_org.id, v_seats, 'monthly_snapshot', null, now(), v_org.id::text || ':active_staff_seats_monthly:' || v_month_key);
    perform public.record_billing_usage_event_system(v_org.id, 'storage_gb_monthly', 'organization', v_org.id, v_storage, 'monthly_snapshot', null, now(), v_org.id::text || ':storage_gb_monthly:' || v_month_key);

    perform public.snapshot_billing_usage_period_system(v_org.id, 'active_clubs_monthly', v_period_start, v_period_end);
    perform public.snapshot_billing_usage_period_system(v_org.id, 'active_players_monthly', v_period_start, v_period_end);
    perform public.snapshot_billing_usage_period_system(v_org.id, 'active_teams_monthly', v_period_start, v_period_end);
    perform public.snapshot_billing_usage_period_system(v_org.id, 'active_staff_seats_monthly', v_period_start, v_period_end);
    perform public.snapshot_billing_usage_period_system(v_org.id, 'storage_gb_monthly', v_period_start, v_period_end);
  end loop;
end $$;

revoke all on function public.run_monthly_usage_snapshot() from public, anon, authenticated;
grant execute on function public.run_monthly_usage_snapshot() to service_role;
