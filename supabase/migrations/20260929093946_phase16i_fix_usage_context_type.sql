-- Second bug caught by actually running it: billing_usage_events.context_type has
-- a CHECK constraint (platform/club/tournament/shared -- the same vocabulary as
-- billing_usage_meters.product), not "organization". context_id was also wrong
-- for a gauge -- there's no specific "thing" being referenced the way an entry
-- id is for the counter meter, so it's null here, not the org id repeated.
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

    perform public.record_billing_usage_event_system(v_org.id, 'active_clubs_monthly', 'club', null, v_clubs, 'monthly_snapshot', null, now(), v_org.id::text || ':active_clubs_monthly:' || v_month_key);
    perform public.record_billing_usage_event_system(v_org.id, 'active_players_monthly', 'club', null, v_players, 'monthly_snapshot', null, now(), v_org.id::text || ':active_players_monthly:' || v_month_key);
    perform public.record_billing_usage_event_system(v_org.id, 'active_teams_monthly', 'shared', null, v_teams, 'monthly_snapshot', null, now(), v_org.id::text || ':active_teams_monthly:' || v_month_key);
    perform public.record_billing_usage_event_system(v_org.id, 'active_staff_seats_monthly', 'shared', null, v_seats, 'monthly_snapshot', null, now(), v_org.id::text || ':active_staff_seats_monthly:' || v_month_key);
    perform public.record_billing_usage_event_system(v_org.id, 'storage_gb_monthly', 'shared', null, v_storage, 'monthly_snapshot', null, now(), v_org.id::text || ':storage_gb_monthly:' || v_month_key);

    perform public.snapshot_billing_usage_period_system(v_org.id, 'active_clubs_monthly', v_period_start, v_period_end);
    perform public.snapshot_billing_usage_period_system(v_org.id, 'active_players_monthly', v_period_start, v_period_end);
    perform public.snapshot_billing_usage_period_system(v_org.id, 'active_teams_monthly', v_period_start, v_period_end);
    perform public.snapshot_billing_usage_period_system(v_org.id, 'active_staff_seats_monthly', v_period_start, v_period_end);
    perform public.snapshot_billing_usage_period_system(v_org.id, 'storage_gb_monthly', v_period_start, v_period_end);
  end loop;
end $$;

revoke all on function public.run_monthly_usage_snapshot() from public, anon, authenticated;
grant execute on function public.run_monthly_usage_snapshot() to service_role;
