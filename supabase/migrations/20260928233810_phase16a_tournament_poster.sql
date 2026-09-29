-- Tournament poster upload. tournaments_write is is_org_admin(org_id)-only, so an
-- Organizer (tournament_staff, not an org member) has no direct write path to
-- tournaments.poster_url -- same shape as set_public_listing/set_listing_block. This is
-- the checked write; the actual bytes go to the public 'tournament-posters' storage
-- bucket via the service role from a server action (storage.objects' own RLS is
-- platform-admin-only, same reasoning as everywhere else that touches the file first,
-- then calls a checked function to record it).
--
-- manage_tournament is the Organizer's own "configure tournament identity" permission
-- (phase8b's own description already lists it) -- no new permission key needed. A
-- platform admin may set any tournament's poster regardless of org, matching the
-- platform console's Listings tab, which manages every tenant's directory presence.

create or replace function public.set_tournament_poster(p_tournament_id uuid, p_poster_url text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from public.tournaments where id = p_tournament_id;
  if v_org is null then raise exception 'tournament not found' using errcode = 'no_data_found'; end if;
  if not public.org_access_allowed(v_org) then
    raise exception 'this organization is suspended' using errcode = 'insufficient_privilege';
  end if;
  if not (public.is_platform_admin() or public.is_org_admin(v_org) or public.has_tournament_permission('manage_tournament', p_tournament_id)) then
    raise exception 'you cannot change this tournament''s poster' using errcode = 'insufficient_privilege';
  end if;
  update public.tournaments set poster_url = nullif(btrim(p_poster_url), '') where id = p_tournament_id;
  perform public.write_audit_system(v_org, 'tournament.poster.updated', 'tournament', p_tournament_id,
    'tournament', p_tournament_id::text, null, jsonb_build_object('poster_url', p_poster_url));
end $$;

revoke all on function public.set_tournament_poster(uuid, text) from public, anon;
grant execute on function public.set_tournament_poster(uuid, text) to authenticated, service_role;
