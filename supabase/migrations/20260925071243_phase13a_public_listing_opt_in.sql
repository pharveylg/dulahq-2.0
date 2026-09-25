-- Public listing: the owner opts in, held by the club IT admin and tournament IT admin
-- (docs/proposals/public-listing.md). A platform admin can block.
--
-- State this replaces: publicly_listed was writable by any club manager straight through
-- the API (clubs_admin_write allows every column) with no screen offering it, and a
-- tournament IT admin could not write it at all (tournaments_write is is_org_admin).
-- Nothing guarded the flag, so this adds a trigger, and RPCs so the IT roles -- who have
-- no table write access -- can act.

-- 1. Two catalog keys (not one reused key: the club/tournament resolvers differ).
insert into public.permissions (key, category, scope, label, description) values
  ('manage_club_listing', 'staff', 'club', 'Manage public listing',
   'Show the club in, or remove it from, the public directory'),
  ('manage_tournament_listing', 'staff', 'tournament', 'Manage public listing',
   'Show the tournament in, or remove it from, the public directory')
on conflict (key) do nothing;

insert into public.role_permission_defaults (role, permission_key) values
  ('club_it_admin', 'manage_club_listing'),
  ('tournament_it_admin', 'manage_tournament_listing')
on conflict do nothing;

-- 2. The platform's override, kept separate from the owner's choice so unblocking
-- restores exactly what the owner had.
alter table public.clubs add column if not exists listing_blocked boolean not null default false;
alter table public.clubs add column if not exists listing_block_reason text;
alter table public.tournaments add column if not exists listing_blocked boolean not null default false;
alter table public.tournaments add column if not exists listing_block_reason text;

create or replace view public.public_clubs with (security_invoker = true) as
 select c.id, c.name, c.slug, c.about, c.location, c.sport_id,
        o.slug as org_slug, o.name as org_name, o.accent as org_accent,
        (c.branding ->> 'logoKey'::text) as logo_key, o.logo_url as org_logo_url
   from public.clubs c join public.organizations o on o.id = c.org_id
  where c.publicly_listed = true and not c.listing_blocked and o.status = 'active';

create or replace view public.public_tournaments with (security_invoker = true) as
 select t.id, t.name, t.slug, t.poster_url, t.event_date, t.venue, t.sport_id,
        o.slug as org_slug, o.name as org_name, o.accent as org_accent, o.logo_url as org_logo_url
   from public.tournaments t join public.organizations o on o.id = t.org_id
  where t.publicly_listed = true and not t.listing_blocked and o.status = 'active';

-- The direct-table anon policies must agree with the views, or a blocked row stays
-- readable from the table itself.
drop policy if exists "clubs public read listed clubs" on public.clubs;
create policy "clubs public read listed clubs" on public.clubs for select to anon, authenticated
  using (publicly_listed = true and not listing_blocked);
drop policy if exists "tournaments public read published tournaments" on public.tournaments;
create policy "tournaments public read published tournaments" on public.tournaments for select to anon, authenticated
  using (publicly_listed = true and not listing_blocked);

-- 3. One rule, used by both the trigger and the RPC.
--   turning ON   : org admin, or the listing permission (club / tournament), or platform admin
--   turning OFF  : those, plus anyone who administers the club / holds manage_tournament --
--                  taking something down is always safe
create or replace function public.can_change_listing(p_kind text, p_org uuid, p_id uuid, p_turning_on boolean)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or public.is_org_admin(p_org)
      or case p_kind
           when 'club' then
             public.has_staff_permission('manage_club_listing', p_id)
             or (not p_turning_on and public.can_admin_club(p_org, p_id))
           when 'tournament' then
             public.has_tournament_permission('manage_tournament_listing', p_id)
             or (not p_turning_on and public.has_tournament_permission('manage_tournament', p_id))
           else false
         end;
$$;
revoke all on function public.can_change_listing(text, uuid, uuid, boolean) from public, anon;
grant execute on function public.can_change_listing(text, uuid, uuid, boolean) to authenticated, service_role;

-- 4. The guard. Calls with no signed-in user (the service role, migrations, the SQL
-- editor) pass; everyone who reaches these tables through the API is checked.
create or replace function public.guard_listing_flags()
returns trigger language plpgsql set search_path = public as $$
declare
  v_kind text := case tg_table_name when 'clubs' then 'club' else 'tournament' end;
  v_old_listed boolean := case when tg_op = 'INSERT' then false else old.publicly_listed end;
  v_old_blocked boolean := case when tg_op = 'INSERT' then false else old.listing_blocked end;
  v_old_reason text := case when tg_op = 'INSERT' then null else old.listing_block_reason end;
begin
  if auth.uid() is null or public.is_platform_admin() then return new; end if;

  if new.listing_blocked is distinct from v_old_blocked
     or new.listing_block_reason is distinct from v_old_reason then
    raise exception 'only a platform admin can block or unblock a listing' using errcode = 'insufficient_privilege';
  end if;

  if new.publicly_listed is distinct from v_old_listed
     and not public.can_change_listing(v_kind, new.org_id, new.id, new.publicly_listed) then
    raise exception 'you do not have permission to change this public listing' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

drop trigger if exists guard_listing_flags on public.clubs;
create trigger guard_listing_flags before insert or update on public.clubs
  for each row execute function public.guard_listing_flags();
drop trigger if exists guard_listing_flags on public.tournaments;
create trigger guard_listing_flags before insert or update on public.tournaments
  for each row execute function public.guard_listing_flags();

-- 5. RPCs, so the IT roles (no table write access) can act, audited.
create or replace function public.set_public_listing(p_kind text, p_id uuid, p_listed boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_before boolean;
begin
  if p_kind = 'club' then
    select org_id, publicly_listed into v_org, v_before from public.clubs where id = p_id;
  elsif p_kind = 'tournament' then
    select org_id, publicly_listed into v_org, v_before from public.tournaments where id = p_id;
  else
    raise exception 'unknown kind %', p_kind using errcode = 'invalid_parameter_value';
  end if;
  if v_org is null then raise exception '% not found', p_kind using errcode = 'no_data_found'; end if;
  if not public.can_change_listing(p_kind, v_org, p_id, p_listed) then
    raise exception 'you do not have permission to change this public listing' using errcode = 'insufficient_privilege';
  end if;

  if v_before is distinct from p_listed then
    if p_kind = 'club' then update public.clubs set publicly_listed = p_listed where id = p_id;
    else update public.tournaments set publicly_listed = p_listed where id = p_id; end if;
    perform public.write_audit_system(v_org, p_kind || '.listing.changed', p_kind, p_id,
      p_kind, p_id::text, jsonb_build_object('publicly_listed', v_before), jsonb_build_object('publicly_listed', p_listed));
  end if;
end $$;
revoke all on function public.set_public_listing(text, uuid, boolean) from public, anon;
grant execute on function public.set_public_listing(text, uuid, boolean) to authenticated, service_role;

create or replace function public.set_listing_block(p_kind text, p_id uuid, p_blocked boolean, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_before boolean;
begin
  if not public.is_platform_admin() then
    raise exception 'only a platform admin can block or unblock a listing' using errcode = 'insufficient_privilege';
  end if;
  if p_blocked and coalesce(btrim(p_reason), '') = '' then
    raise exception 'a reason is required to block a listing' using errcode = 'invalid_parameter_value';
  end if;
  if p_kind = 'club' then
    select org_id, listing_blocked into v_org, v_before from public.clubs where id = p_id;
  elsif p_kind = 'tournament' then
    select org_id, listing_blocked into v_org, v_before from public.tournaments where id = p_id;
  else
    raise exception 'unknown kind %', p_kind using errcode = 'invalid_parameter_value';
  end if;
  if v_org is null then raise exception '% not found', p_kind using errcode = 'no_data_found'; end if;

  if p_kind = 'club' then
    update public.clubs set listing_blocked = p_blocked, listing_block_reason = case when p_blocked then btrim(p_reason) end where id = p_id;
  else
    update public.tournaments set listing_blocked = p_blocked, listing_block_reason = case when p_blocked then btrim(p_reason) end where id = p_id;
  end if;
  perform public.write_audit_system(v_org, p_kind || '.listing.blocked', p_kind, p_id,
    p_kind, p_id::text, jsonb_build_object('listing_blocked', v_before),
    jsonb_build_object('listing_blocked', p_blocked, 'reason', p_reason));
end $$;
revoke all on function public.set_listing_block(text, uuid, boolean, text) from public, anon;
grant execute on function public.set_listing_block(text, uuid, boolean, text) to authenticated, service_role;
