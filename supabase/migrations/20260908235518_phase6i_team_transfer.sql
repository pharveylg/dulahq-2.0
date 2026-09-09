-- Phase: player movement / team transfer (CLAUDE.md §0c). team_memberships
-- has existed since phase3_free_the_player with zero application code --
-- exactly the "one row per team stint" shape this feature needs, so no new
-- table. Backfill an initial stint for every player so "journey" doesn't
-- start empty for the whole existing roster -- from_date uses players.
-- created_at as the best available proxy for when they joined their
-- current team (not a real join date, just what's actually knowable).
insert into public.team_memberships (org_id, player_id, team_id, jersey, position, from_date, to_date)
select p.org_id, p.id, p.team_id, p.jersey, p.position, p.created_at::date, null
from public.players p
where p.team_id is not null
  and not exists (
    select 1 from public.team_memberships tm where tm.player_id = p.id
  );

-- Moving a player between two of the SAME club's teams, preserving history.
-- Not a plain table update from the app: players_write's WITH CHECK only
-- verifies is_org_member(org_id), never re-checks permission against the
-- *destination* team, so a raw update would let a coach reassign a player
-- into their own team from someone else's without the destination team's
-- staff having any say. This function authorizes once (manage_membership,
-- the existing club-scope permission already used for the Membership tab)
-- against the shared club, then does all three writes atomically: close
-- the old stint, open the new one, move players.team_id.
create or replace function public.transfer_player_to_team(p_player_id uuid, p_new_team_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_player record;
  v_old_club_id uuid;
  v_new_club_id uuid;
  v_new_id uuid;
begin
  select id, org_id, team_id, jersey, position into v_player from public.players where id = p_player_id;
  if not found then
    raise exception 'player not found';
  end if;

  select club_id into v_old_club_id from public.teams where id = v_player.team_id;
  select club_id into v_new_club_id from public.teams where id = p_new_team_id;

  if v_new_club_id is null then
    raise exception 'destination team not found';
  end if;
  if v_old_club_id is distinct from v_new_club_id then
    raise exception 'cannot transfer a player to a team in a different club';
  end if;

  if not public.has_staff_permission('manage_membership', v_old_club_id) then
    raise exception 'not authorized to manage this club''s team memberships';
  end if;

  if v_player.team_id = p_new_team_id then
    raise exception 'player is already on that team';
  end if;

  update public.team_memberships
     set to_date = current_date
   where player_id = p_player_id
     and team_id = v_player.team_id
     and to_date is null;

  insert into public.team_memberships (org_id, player_id, team_id, jersey, position, from_date, created_by)
  values (v_player.org_id, p_player_id, p_new_team_id, v_player.jersey, v_player.position, current_date, auth.uid())
  returning id into v_new_id;

  update public.players set team_id = p_new_team_id where id = p_player_id;

  perform public.write_audit(v_player.org_id, 'movement.team_transferred',
    'team', p_new_team_id, 'player', p_player_id::text,
    jsonb_build_object('team_id', v_player.team_id), jsonb_build_object('team_id', p_new_team_id));

  return v_new_id;
end;
$$;

revoke all on function public.transfer_player_to_team(uuid, uuid) from public;
revoke all on function public.transfer_player_to_team(uuid, uuid) from anon;
grant execute on function public.transfer_player_to_team(uuid, uuid) to authenticated;
