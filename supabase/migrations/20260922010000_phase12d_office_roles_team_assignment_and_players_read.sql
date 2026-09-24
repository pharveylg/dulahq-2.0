-- §0s finding 5, closing it. "Club office roles team assignment" was asked as a
-- UI fix -- widen TEAM_SCOPED_ROLES (StaffRow.tsx / page.tsx) so treasurer,
-- secretary and staff can be assigned to a team, the same way assistant_coach
-- was added in phase6x. That part needed no migration: uat_insert already
-- authorizes on the ASSIGNER's assign_team_staff/is_org_admin, never on the
-- assignee's own role, so club_manager and team_manager could already put any
-- club_staff row on a team. The only thing stopping it was the UI array.
--
-- Verifying that fix live surfaced a second, real bug in the same family --
-- not hypothetical, reproduced directly: a plain `staff` role holding
-- view_finances/manage_finances (club-wide, per the permission catalog) reads
-- a fee_charges row fine, but its embedded `players(name)` comes back null,
-- because `players_read` has never consulted the permission catalog at all --
-- only is_assigned_to_team, can_read_club (club_manager/org_admin only), or
-- guardian/self. So the club-wide Finances tab -- reachable with NO team
-- assignment, since view_finances is club-scope -- showed every charge with
-- "Unknown" as the player, for anyone who wasn't a club_manager/org_admin or
-- individually assigned to that specific player's team. Team assignment fixes
-- this per-team; it does not fix it for the club-wide screen the permission is
-- supposed to unlock, which is the whole point of "manage_finances" being
-- club-scope rather than team-scope in the catalog in the first place.
--
-- Fixed by giving players_read the same branch fee_charges/memberships/
-- document_uploads already have: read access for whoever holds the club-scope
-- permission that table's own write policy already trusts club-wide. Read
-- only -- players_write is untouched, so a treasurer still cannot rename a
-- player or change their jersey number, only see who they are. The permission
-- check is against `club_id` (the PLAYER's own club, not the caller's), so a
-- treasurer at a different club gains nothing -- has_staff_permission's own
-- club_staff join requires cs.club_id = the id passed in, which the cross-
-- tenant test below pins.
--
-- Writing that branch surfaced a THIRD bug, found while pinning it with a
-- test rather than by inspection: every one of the 108 real players in this
-- database has club_id set, which looked like nothing to fix -- until
-- checking how they got it showed no trigger or default ever sets it, and
-- `addPlayer` (teams/[teamSlug]/actions.ts) receives a clubId parameter and
-- never uses it. Those 108 are all seeded directly; the next player added
-- through the live "+ Add player" form would have been the first with a null
-- club_id, silently invisible to the branch just added above. `fill_org_id`
-- already derives org_id from team_id on insert (fill_org_id_from_parent);
-- club_id gets the same treatment here rather than a one-off fix in the
-- action, so every insert path -- this form, a future one, a script -- is
-- covered the same way org_id already is, and the action needed no code
-- change (team_id was always enough).
create or replace function public.fill_club_id_from_team()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.club_id is not null or new.team_id is null then
    return new;
  end if;
  select club_id into new.club_id from public.teams where id = new.team_id;
  return new;
end $$;

drop trigger if exists fill_club_id on public.players;
create trigger fill_club_id before insert on public.players
for each row execute function public.fill_club_id_from_team();

-- EXECUTE defaults to PUBLIC on function creation (§0g) -- anon_executable_secdef_
-- count() caught this omission immediately on the first full suite run.
revoke all on function public.fill_club_id_from_team() from public, anon;
grant execute on function public.fill_club_id_from_team() to authenticated, service_role;

drop policy if exists players_read on public.players;
create policy players_read on public.players for select
using (
  is_org_member(org_id) and (
    is_assigned_to_team(team_id)
    or exists (
      select 1 from public.teams t
      where t.id = players.team_id and public.can_read_club(players.org_id, t.club_id)
    )
    or is_guardian_of(id)
    or user_id = auth.uid()
    or (
      club_id is not null and (
        public.has_staff_permission('view_finances', club_id)
        or public.has_staff_permission('manage_finances', club_id)
        or public.has_staff_permission('manage_documents', club_id)
        or public.has_staff_permission('manage_membership', club_id)
      )
    )
  )
);
