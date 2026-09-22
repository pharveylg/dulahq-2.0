-- Linking a login to a player had the same broken email lookup as add staff (a plain
-- select on public.users that nobody but a platform admin can see past their own
-- row). Same fix. The authority is copied from players_write, which is what the old
-- code relied on when it updated the row directly: an org member who is assigned to
-- the player's team or can administer its club. Refusal comes before the lookup.
--
-- It also writes an audit row now. Attaching a login to a minor's player record is
-- exactly the kind of change that should be attributable, and it wasn't.
create or replace function public.link_player_account(p_player_id uuid, p_email text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_player record;
  v_club   uuid;
  v_user   public.users%rowtype;
begin
  select id, org_id, team_id into v_player from public.players where id = p_player_id;
  if not found then raise exception 'player not found' using errcode = 'no_data_found'; end if;
  select club_id into v_club from public.teams where id = v_player.team_id;

  if not (public.is_org_member(v_player.org_id)
          and (public.is_assigned_to_team(v_player.team_id) or public.can_admin_club(v_player.org_id, v_club))) then
    raise exception 'not authorized to link a login to this player' using errcode = 'insufficient_privilege';
  end if;

  select * into v_user from public.users where lower(email) = lower(btrim(p_email));
  if not found then
    raise exception 'no Dula HQ account exists for that email' using errcode = 'no_data_found';
  end if;

  update public.players set user_id = v_user.id where id = p_player_id;

  perform public.write_audit_system(
    v_player.org_id, 'player.account_linked', 'club', v_club, 'player', p_player_id::text, null,
    jsonb_build_object('user_id', v_user.id, 'email', v_user.email));
end $$;

revoke all on function public.link_player_account(uuid, text) from public, anon;
grant execute on function public.link_player_account(uuid, text) to authenticated, service_role;
