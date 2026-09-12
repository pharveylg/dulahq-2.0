-- Initial zero-priced plan limits for validation. These are included
-- quantities, not customer charges; overage rates remain zero until pricing
-- is approved.

do $$
declare
  v_club uuid;
  v_tournament uuid;
  v_combined uuid;
begin
  select id into v_club from public.billing_plans where plan_key = 'club-basic' and version = 1;
  select id into v_tournament from public.billing_plans where plan_key = 'tournament-basic' and version = 1;
  select id into v_combined from public.billing_plans where plan_key = 'combined-basic' and version = 1;

  insert into public.billing_plan_meters(plan_id, meter_key, included_quantity, overage_unit_amount)
  select v_club, meter_key, included_quantity, 0
  from (values
    ('active_clubs_monthly', 1::numeric),
    ('active_teams_monthly', 10::numeric),
    ('active_players_monthly', 100::numeric),
    ('active_staff_seats_monthly', 20::numeric),
    ('storage_gb_monthly', 10::numeric)
  ) as limits(meter_key, included_quantity)
  where v_club is not null
  on conflict (plan_id, meter_key) do nothing;

  insert into public.billing_plan_meters(plan_id, meter_key, included_quantity, overage_unit_amount)
  select v_tournament, meter_key, included_quantity, 0
  from (values
    ('active_tournaments_monthly', 1::numeric),
    ('tournament_entries_monthly', 50::numeric),
    ('active_staff_seats_monthly', 10::numeric),
    ('storage_gb_monthly', 10::numeric)
  ) as limits(meter_key, included_quantity)
  where v_tournament is not null
  on conflict (plan_id, meter_key) do nothing;

  insert into public.billing_plan_meters(plan_id, meter_key, included_quantity, overage_unit_amount)
  select v_combined, meter_key, included_quantity, 0
  from (values
    ('active_clubs_monthly', 1::numeric),
    ('active_teams_monthly', 20::numeric),
    ('active_players_monthly', 200::numeric),
    ('active_staff_seats_monthly', 30::numeric),
    ('active_tournaments_monthly', 2::numeric),
    ('tournament_entries_monthly', 100::numeric),
    ('storage_gb_monthly', 25::numeric)
  ) as limits(meter_key, included_quantity)
  where v_combined is not null
  on conflict (plan_id, meter_key) do nothing;
end $$;
