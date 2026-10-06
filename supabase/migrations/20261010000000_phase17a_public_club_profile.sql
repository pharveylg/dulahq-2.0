-- Public club profile: contact details, opted-in coaches, and an opt-in roster.
--
-- Everything shown to a guest is decided by the person it describes, never by club
-- staff alone:
--   club contact        the club manager sets it (clubs row, already writable by them)
--   coaches / staff     each person opts themselves in (staff_profiles.show_publicly)
--   players             the player (if an adult) or a guardian (for a minor) opts in
--                       through set_player_public_listing(), the only write path
-- Names are always shown as first name plus last initial. No date of birth, guardian,
-- evaluation, note, fee or contact detail for a player is ever returned.

alter table public.clubs add column if not exists contact_email text;
alter table public.clubs add column if not exists contact_phone text;

alter table public.staff_profiles add column if not exists show_publicly boolean not null default false;

-- Self-only opt-in for staff. A club admin can already edit a staff profile row, so
-- the flag is guarded here rather than trusted to the policy that allows the write.
create or replace function public.guard_staff_public_flag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_platform_admin() then
    return new;
  end if;
  if (tg_op = 'INSERT' and new.show_publicly)
     or (tg_op = 'UPDATE' and new.show_publicly is distinct from old.show_publicly) then
    if not exists (
      select 1 from public.club_staff cs
      where cs.id = new.club_staff_id and cs.user_id = auth.uid()
    ) then
      raise exception 'Only the staff member can change whether they appear on the public club page'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_staff_public_flag() from public, anon;
grant execute on function public.guard_staff_public_flag() to authenticated, service_role;

drop trigger if exists staff_profiles_public_flag_guard on public.staff_profiles;
create trigger staff_profiles_public_flag_guard
  before insert or update on public.staff_profiles
  for each row execute function public.guard_staff_public_flag();

-- The player-side opt-in. Kept in its own table so no existing players write policy
-- (team staff can update any column of a player row) can flip it.
create table if not exists public.player_public_profiles (
  player_id uuid primary key references public.players(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  show_publicly boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.player_public_profiles enable row level security;

revoke all on public.player_public_profiles from anon, public;
revoke insert, update, delete on public.player_public_profiles from authenticated;
grant select on public.player_public_profiles to authenticated;

create policy player_public_profiles_read on public.player_public_profiles for select to authenticated
using (
  public.is_platform_admin()
  or public.is_player_self(player_id)
  or public.has_guardian_permission('share_public_profile', player_id)
  or exists (
    select 1 from public.players p
    where p.id = player_id and public.can_admin_club(p.org_id, p.club_id)
  )
);

create policy org_not_suspended on public.player_public_profiles as restrictive for all to authenticated
using (public.org_access_allowed(org_id));

insert into public.permissions (key, category, scope, label, description) values
  ('share_public_profile', 'guardian', 'player', 'Show on public club page',
   'Show the player on the club''s public roster, as first name and last initial')
on conflict (key) do nothing;

insert into public.guardian_permission_defaults (permission_key) values ('share_public_profile')
on conflict do nothing;

create or replace function public.set_player_public_listing(p_player_id uuid, p_show boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_club uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select p.org_id, p.club_id into v_org, v_club from public.players p where p.id = p_player_id;
  if v_org is null then
    raise exception 'Player not found' using errcode = '42501';
  end if;

  if not (
    public.is_player_self(p_player_id)
    or public.has_guardian_permission('share_public_profile', p_player_id)
  ) then
    raise exception 'You can only change this for your own profile or a child you are a guardian of'
      using errcode = '42501';
  end if;

  insert into public.player_public_profiles (player_id, org_id, show_publicly, updated_by, updated_at)
  values (p_player_id, v_org, p_show, auth.uid(), now())
  on conflict (player_id) do update
    set show_publicly = excluded.show_publicly,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  perform public.write_audit(v_org, 'player.public_listing.changed', 'club', v_club,
    'player', p_player_id::text, null, jsonb_build_object('show_publicly', p_show));
end $$;
revoke all on function public.set_player_public_listing(uuid, boolean) from public, anon;
grant execute on function public.set_player_public_listing(uuid, boolean) to authenticated, service_role;

create or replace function public.public_display_name(p_full text)
returns text language sql immutable set search_path = public as $$
  select case
    when p_full is null or btrim(p_full) = '' then null
    when position(' ' in btrim(p_full)) = 0 then btrim(p_full)
    else regexp_replace(btrim(p_full), '\s.*$', '') || ' '
         || left(regexp_replace(btrim(p_full), '^.*\s', ''), 1) || '.'
  end;
$$;
revoke all on function public.public_display_name(text) from public;

-- Anon-callable on purpose: the only anonymous read of club people. It returns nothing
-- unless the club is listed, not blocked, and its org is active, and it returns only
-- what each person opted into. Added to the anon_executable_secdef_allowlist() like
-- entry_login_background, so the zero-count guard stays honest.
create or replace function public.public_club_profile(p_club_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_club public.clubs%rowtype;
  v_org_name text;
begin
  select cl.* into v_club
  from public.clubs cl
  join public.organizations o on o.id = cl.org_id
  where cl.slug = p_club_slug
    and cl.publicly_listed
    and not cl.listing_blocked
    and o.status = 'active';
  if not found then
    return null;
  end if;

  select o.name into v_org_name from public.organizations o where o.id = v_club.org_id;

  return jsonb_build_object(
    'club', jsonb_build_object(
      'name', v_club.name,
      'about', v_club.about,
      'location', v_club.location,
      'contactEmail', v_club.contact_email,
      'contactPhone', v_club.contact_phone,
      'orgName', v_org_name
    ),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', public.public_display_name(u.name),
        'role', cs.role,
        'bio', sp.bio,
        'teams', coalesce((
          select jsonb_agg(t.name order by t.name)
          from public.user_assigned_teams uat
          join public.teams t on t.id = uat.team_id
          where uat.user_id = cs.user_id and t.club_id = v_club.id
        ), '[]'::jsonb)
      ) order by cs.role, u.name)
      from public.club_staff cs
      join public.users u on u.id = cs.user_id
      join public.staff_profiles sp on sp.club_staff_id = cs.id
      where cs.club_id = v_club.id
        and cs.status = 'active'
        and cs.role in ('club_manager', 'coach', 'assistant_coach', 'team_manager')
        and sp.show_publicly
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', t.name,
        'squadType', t.squad_type,
        'players', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', public.public_display_name(p.name),
            'jersey', p.jersey,
            'position', p.position
          ) order by p.name)
          from public.players p
          join public.player_public_profiles pp on pp.player_id = p.id and pp.show_publicly
          where p.team_id = t.id
        ), '[]'::jsonb)
      ) order by t.name)
      from public.teams t
      where t.club_id = v_club.id
    ), '[]'::jsonb)
  );
end $$;
revoke all on function public.public_club_profile(text) from public;
grant execute on function public.public_club_profile(text) to anon, authenticated, service_role;

create or replace function public.anon_executable_secdef_allowlist()
returns text[]
language sql immutable as $$
  select array['entry_login_background', 'public_club_profile'];
$$;
revoke all on function public.anon_executable_secdef_allowlist() from public, anon, authenticated;
grant execute on function public.anon_executable_secdef_allowlist() to authenticated, service_role;
