-- Phase 2 of docs/proposals/self-serve-org-onboarding.md: real product trials with
-- transactional hard caps. Zero org_entitlements rows have ever had valid_until set
-- (confirmed live before writing this), so this is the safe moment to fix the
-- date/timestamptz mismatch flagged in Phase 0's audit rather than carry it forward.

alter table public.org_entitlements alter column valid_until type timestamptz using valid_until::timestamptz;

create or replace function public.org_has_product(org uuid, p_product text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_entitlements e
    where e.org_id = org
      and e.product = p_product
      and e.status in ('active','trial')
      and (e.valid_until is null or e.valid_until >= now())
  );
$$;
revoke all on function public.org_has_product(uuid, text) from public, anon;
grant execute on function public.org_has_product(uuid, text) to authenticated, service_role;

-- One atomic start: org_entitlements(trial) + billing_subscriptions(trial), sharing
-- ONE clock across every product this org ever trials (the review's "adding a
-- product later does not restart or extend the clock") -- read once, reused if a
-- trial already exists, otherwise computed fresh from trial_policy.
create or replace function public.start_product_trial(p_org_id uuid, p_products text[])
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_trial_days integer;
  v_end timestamptz;
  v_product text;
  v_plan_id uuid;
  v_started text[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.is_org_admin(p_org_id) then
    raise exception 'Only this organization''s admin can start a trial' using errcode = '42501';
  end if;
  if p_products is null or array_length(p_products, 1) is null then
    raise exception 'Choose at least one product' using errcode = '22023';
  end if;
  foreach v_product in array p_products loop
    if v_product not in ('club', 'tournament') then
      raise exception 'Invalid product: %', v_product using errcode = '22023';
    end if;
  end loop;

  select e.valid_until into v_end
  from public.org_entitlements e
  where e.org_id = p_org_id and e.status = 'trial' and e.valid_until is not null
  limit 1;

  if v_end is null then
    select trial_days into v_trial_days from public.trial_policy where id = true;
    v_end := now() + (coalesce(v_trial_days, 14) || ' days')::interval;
  end if;

  foreach v_product in array p_products loop
    if exists (select 1 from public.org_entitlements where org_id = p_org_id and product = v_product) then
      continue; -- already has an entitlement for this product, trial or paid -- no-op
    end if;

    insert into public.org_entitlements (org_id, product, status, valid_until)
    values (p_org_id, v_product, 'trial', v_end);

    select id into v_plan_id from public.billing_plans
    where plan_key = case v_product when 'club' then 'club-basic' else 'tournament-basic' end
      and version = 1;
    if v_plan_id is null then
      raise exception 'No published plan for %', v_product using errcode = '22023';
    end if;

    insert into public.billing_subscriptions (org_id, plan_id, product, status, starts_at, ends_at)
    values (p_org_id, v_plan_id, v_product, 'trial', now(), v_end);

    v_started := array_append(v_started, v_product);

    perform public.write_audit_system(p_org_id, 'org.trial.started', null, null,
      'org_entitlement', v_product, null, jsonb_build_object('product', v_product, 'ends_at', v_end));
  end loop;

  -- A real trial replaces the bare-shell deadline -- the review's "stop the 24-hour
  -- shell cleanup" once a product trial exists. Harmless if already gone.
  delete from public.org_onboarding_shells where org_id = p_org_id;

  return jsonb_build_object('started', v_started, 'trialEndsAt', v_end);
end $$;
revoke all on function public.start_product_trial(uuid, text[]) from public, anon;
grant execute on function public.start_product_trial(uuid, text[]) to authenticated, service_role;

-- Four trigger functions, one per capped resource. Each locks the PARENT row first
-- (select ... for update) before counting -- the standard Postgres answer to the
-- review's own "count then insert can be bypassed by concurrent requests" warning:
-- two simultaneous inserts against the same parent are forced to take that lock
-- one after the other, so the second one's count always sees the first one's row.
-- Each is a no-op once the entitlement is 'active' (paid) rather than 'trial', and
-- a no-op entirely when trial_caps has no row for that key (cap not configured).

create or replace function public.enforce_trial_club_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_limit integer;
  v_count integer;
begin
  if new.org_id is not null then
    perform 1 from public.organizations where id = new.org_id for update;
    select status into v_status from public.org_entitlements where org_id = new.org_id and product = 'club';
    if v_status = 'trial' then
      select limit_value into v_limit from public.trial_caps where product = 'club' and limit_key = 'clubs_per_org';
      if v_limit is not null then
        select count(*) into v_count from public.clubs where org_id = new.org_id;
        if v_count >= v_limit then
          raise exception 'Trial limit reached: this organization can have at most % club(s) during trial. Upgrade to add more.', v_limit
            using errcode = 'check_violation';
        end if;
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.enforce_trial_club_cap() from public, anon;
grant execute on function public.enforce_trial_club_cap() to authenticated, service_role;
drop trigger if exists trial_club_cap on public.clubs;
create trigger trial_club_cap before insert on public.clubs
  for each row execute function public.enforce_trial_club_cap();

-- Named to sort after teams' existing "fill_org_id" BEFORE trigger (same timing
-- point: Postgres fires same-timing triggers in name order), since this reads
-- NEW.org_id, which that trigger is the one that sets.
create or replace function public.enforce_trial_team_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_limit integer;
  v_count integer;
begin
  if new.club_id is not null then
    perform 1 from public.clubs where id = new.club_id for update;
    select status into v_status from public.org_entitlements where org_id = new.org_id and product = 'club';
    if v_status = 'trial' then
      select limit_value into v_limit from public.trial_caps where product = 'club' and limit_key = 'teams_per_club';
      if v_limit is not null then
        select count(*) into v_count from public.teams where club_id = new.club_id;
        if v_count >= v_limit then
          raise exception 'Trial limit reached: this club can have at most % team(s) during trial. Upgrade to add more.', v_limit
            using errcode = 'check_violation';
        end if;
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.enforce_trial_team_cap() from public, anon;
grant execute on function public.enforce_trial_team_cap() to authenticated, service_role;
drop trigger if exists trial_team_cap on public.teams;
create trigger trial_team_cap before insert on public.teams
  for each row execute function public.enforce_trial_team_cap();

create or replace function public.enforce_trial_tournament_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_limit integer;
  v_count integer;
begin
  if new.org_id is not null then
    perform 1 from public.organizations where id = new.org_id for update;
    select status into v_status from public.org_entitlements where org_id = new.org_id and product = 'tournament';
    if v_status = 'trial' then
      select limit_value into v_limit from public.trial_caps where product = 'tournament' and limit_key = 'tournaments_per_org';
      if v_limit is not null then
        select count(*) into v_count from public.tournaments where org_id = new.org_id;
        if v_count >= v_limit then
          raise exception 'Trial limit reached: this organization can have at most % tournament(s) during trial. Upgrade to add more.', v_limit
            using errcode = 'check_violation';
        end if;
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.enforce_trial_tournament_cap() from public, anon;
grant execute on function public.enforce_trial_tournament_cap() to authenticated, service_role;
drop trigger if exists trial_tournament_cap on public.tournaments;
create trigger trial_tournament_cap before insert on public.tournaments
  for each row execute function public.enforce_trial_tournament_cap();

-- The cap is counted across the whole tournament (pending + accepted entries,
-- every category), not per category -- a tournament's own category.capacity check
-- (phase9-era) is unrelated and stays exactly as it was.
create or replace function public.enforce_trial_entry_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_host_org uuid;
  v_status text;
  v_limit integer;
  v_count integer;
begin
  perform 1 from public.tournaments where id = new.tournament_id for update;
  select org_id into v_host_org from public.tournaments where id = new.tournament_id;
  if v_host_org is not null then
    select status into v_status from public.org_entitlements where org_id = v_host_org and product = 'tournament';
    if v_status = 'trial' then
      select limit_value into v_limit from public.trial_caps where product = 'tournament' and limit_key = 'entries_per_tournament';
      if v_limit is not null then
        select count(*) into v_count from public.tournament_entries
          where tournament_id = new.tournament_id and status in ('pending', 'accepted');
        if v_count >= v_limit then
          raise exception 'Trial limit reached: this tournament can have at most % pending or accepted entries during trial. Upgrade to add more.', v_limit
            using errcode = 'check_violation';
        end if;
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.enforce_trial_entry_cap() from public, anon;
grant execute on function public.enforce_trial_entry_cap() to authenticated, service_role;
drop trigger if exists trial_entry_cap on public.tournament_entries;
create trigger trial_entry_cap before insert on public.tournament_entries
  for each row execute function public.enforce_trial_entry_cap();
