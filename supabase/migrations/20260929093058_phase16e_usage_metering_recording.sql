-- Wires up the metered-billing scaffold the external "arenaai" commit seeded
-- (billing_usage_meters, billing_plan_meters, record_billing_usage_event /
-- snapshot_billing_usage_period / project_billing_amount) but never
-- populated -- 7 meters catalogued, quotas assigned per plan, zero rows in
-- billing_usage_events. User's own framing: "usage metering typical of any
-- saas platform... gives me data on utilization so I can factor it into
-- pricing... in the future" -- visibility first; overage pricing
-- (billing_plan_meters.overage_unit_amount, currently 0 everywhere) stays a
-- later decision, untouched here.
--
-- Two meter shapes, two recording strategies:
--   - 6 "gauge" meters (active clubs/players/teams/staff seats, storage) --
--     a monthly value, snapshotted once a month by run_monthly_usage_snapshot()
--     below. record_billing_usage_event()'s own idempotency (one event per
--     org/meter/month, keyed by "org:meter:YYYY-MM") means
--     snapshot_billing_usage_period()'s existing SUM aggregation stays
--     correct as-is -- summing exactly one row -- with zero changes to that
--     already-deployed, already-tested function.
--   - 1 "counter" meter (tournament_entries_monthly) -- a genuine discrete
--     event, recorded in real time from the existing "add entry" action
--     (app-code change, this migration only adds the recording surface).
--
-- Storage has no existing source of truth: uploads only ever stored an R2
-- key, never a byte size. org_storage_events is a small append-only ledger
-- (upload events only -- deletions aren't subtracted in this first pass, so
-- the figure is "cumulative uploaded", not "currently stored"; noted as a
-- known simplification) that the monthly job sums into GB. Scoped to
-- R2-backed uploads only (documents, club/staff photos, logos) --
-- tournament posters go through a *different* backend (Supabase Storage,
-- phase2's tournament_posters_storage_bucket), are upsert-in-place per
-- tournament, capped at 5MB and non-accumulating, so left out of this pass.

create table public.org_storage_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id),
  storage_key text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now()
);
create index org_storage_events_org_idx on public.org_storage_events(org_id);

alter table public.org_storage_events enable row level security;

create policy org_storage_events_read on public.org_storage_events for select to authenticated
using (public.is_platform_admin() or public.is_org_member(org_id));

-- No insert/update/delete policy for anyone -- written only by
-- record_storage_event() below, same append-only discipline as audit_log.

create or replace function public.record_storage_event(p_org_id uuid, p_storage_key text, p_size_bytes bigint)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  if not public.is_platform_admin() and not public.is_org_member(p_org_id) then
    raise exception 'not authorized to record storage for this organization' using errcode = 'insufficient_privilege';
  end if;
  insert into public.org_storage_events(org_id, storage_key, size_bytes) values (p_org_id, p_storage_key, p_size_bytes);
end $$;

revoke all on function public.record_storage_event(uuid, text, bigint) from public, anon;
grant execute on function public.record_storage_event(uuid, text, bigint) to authenticated, service_role;

-- Monthly gauge snapshot. service_role only -- triggered by pg_cron,
-- mirroring expire_stale_approvals/expire_temp_logins. Skips suspended orgs
-- (phase9a) -- nothing to meter for an org already fenced off everywhere
-- else.
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

    perform public.record_billing_usage_event(v_org.id, 'active_clubs_monthly', 'organization', v_org.id, v_clubs, 'monthly_snapshot', null, now(), v_org.id::text || ':active_clubs_monthly:' || v_month_key);
    perform public.record_billing_usage_event(v_org.id, 'active_players_monthly', 'organization', v_org.id, v_players, 'monthly_snapshot', null, now(), v_org.id::text || ':active_players_monthly:' || v_month_key);
    perform public.record_billing_usage_event(v_org.id, 'active_teams_monthly', 'organization', v_org.id, v_teams, 'monthly_snapshot', null, now(), v_org.id::text || ':active_teams_monthly:' || v_month_key);
    perform public.record_billing_usage_event(v_org.id, 'active_staff_seats_monthly', 'organization', v_org.id, v_seats, 'monthly_snapshot', null, now(), v_org.id::text || ':active_staff_seats_monthly:' || v_month_key);
    perform public.record_billing_usage_event(v_org.id, 'storage_gb_monthly', 'organization', v_org.id, v_storage, 'monthly_snapshot', null, now(), v_org.id::text || ':storage_gb_monthly:' || v_month_key);

    perform public.snapshot_billing_usage_period(v_org.id, 'active_clubs_monthly', v_period_start, v_period_end);
    perform public.snapshot_billing_usage_period(v_org.id, 'active_players_monthly', v_period_start, v_period_end);
    perform public.snapshot_billing_usage_period(v_org.id, 'active_teams_monthly', v_period_start, v_period_end);
    perform public.snapshot_billing_usage_period(v_org.id, 'active_staff_seats_monthly', v_period_start, v_period_end);
    perform public.snapshot_billing_usage_period(v_org.id, 'storage_gb_monthly', v_period_start, v_period_end);
  end loop;
end $$;

revoke all on function public.run_monthly_usage_snapshot() from public, anon, authenticated;
grant execute on function public.run_monthly_usage_snapshot() to service_role;

select cron.schedule('monthly-usage-snapshot', '0 1 1 * *', $$select public.run_monthly_usage_snapshot()$$);
