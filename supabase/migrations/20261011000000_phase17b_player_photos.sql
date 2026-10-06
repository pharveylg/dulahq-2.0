-- Player photos.
--
-- players.photo_url was added in phase3 and never used: no code wrote or read it,
-- and all 108 rows are null, so it is replaced rather than kept. The new column
-- holds an R2 object key (the same pattern as staff_profiles.photo_key and the club
-- logo), because R2 objects are private and the app signs a URL per request.
--
-- Two separate decisions, each made by the person it concerns:
--   the photo itself    set by a coach with edit rights, the player, or a guardian who
--                       holds share_public_profile for that child (set_player_photo)
--   showing it publicly a separate switch from the name listing (show_photo), so a
--                       family can share a name and jersey without a face
-- A photo is only ever returned to an anonymous visitor when both the listing and the
-- photo switch are on.

alter table public.players drop column if exists photo_url;
alter table public.players add column if not exists photo_key text;

alter table public.player_public_profiles add column if not exists show_photo boolean not null default false;

create or replace function public.set_player_photo(p_player_id uuid, p_key text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_club uuid;
  v_team uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select p.org_id, p.club_id, p.team_id into v_org, v_club, v_team
  from public.players p where p.id = p_player_id;
  if v_org is null then
    raise exception 'Player not found' using errcode = '42501';
  end if;

  if not (
    public.is_player_self(p_player_id)
    or public.has_guardian_permission('share_public_profile', p_player_id)
    or public.has_staff_permission('edit_player_football_profile', v_club, v_team)
    or public.can_admin_club(v_org, v_club)
  ) then
    raise exception 'You do not have permission to change this player''s photo' using errcode = '42501';
  end if;

  update public.players set photo_key = p_key where id = p_player_id;

  perform public.write_audit(v_org, 'player.photo.updated', 'club', v_club,
    'player', p_player_id::text, null, jsonb_build_object('has_photo', p_key is not null));
end $$;
revoke all on function public.set_player_photo(uuid, text) from public, anon;
grant execute on function public.set_player_photo(uuid, text) to authenticated, service_role;

create or replace function public.set_player_public_photo(p_player_id uuid, p_show boolean)
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

  insert into public.player_public_profiles (player_id, org_id, show_photo, updated_by, updated_at)
  values (p_player_id, v_org, p_show, auth.uid(), now())
  on conflict (player_id) do update
    set show_photo = excluded.show_photo,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  perform public.write_audit(v_org, 'player.public_photo.changed', 'club', v_club,
    'player', p_player_id::text, null, jsonb_build_object('show_photo', p_show));
end $$;
revoke all on function public.set_player_public_photo(uuid, boolean) from public, anon;
grant execute on function public.set_player_public_photo(uuid, boolean) to authenticated, service_role;

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
            'position', p.position,
            'photoKey', case when pp.show_photo then p.photo_key end
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
