-- Phase D (CLAUDE.md §0d backlog): "No 'primary coach' concept exists, so
-- 'Team Manager may assign coaches but not remove the primary coach'
-- (Team Manager spec §9) is not expressible."
--
-- Checking the live database first turned up a second, larger problem: that
-- rule was unenforceable in the *other* direction too, because nobody below
-- org admin could assign anyone to a team at all. `uat_write` was
-- `is_org_admin(org_id)` for all commands, while `StaffRow.tsx` shows an
-- "+ Assign to team" control to the club manager -- who is generally NOT an
-- org admin (§0b: club staff routinely have no org_members row). Verified by
-- impersonating the showcase club manager: the insert is refused, 42501. So
-- the button has been failing for the role that owns the club, and team
-- assignment has only ever worked for an org admin or the seed script's
-- service-role key.
--
-- Two facts, one column: which team someone is assigned to already lives in
-- user_assigned_teams, and "primary" is a fact about that assignment, not
-- about the person -- club_staff.role is club-wide, so it cannot say who
-- leads which team.

alter table public.user_assigned_teams
  add column if not exists is_primary boolean not null default false;

-- One primary per team, enforced rather than merely intended.
create unique index if not exists uat_one_primary_coach_per_team
  on public.user_assigned_teams (team_id) where is_primary;

-- Backfill: every team in this database has exactly one assigned coach, so
-- there is nothing to guess. A team with two would deliberately be left with
-- no primary for a human to designate -- hence the "= 1" rather than a
-- pick-the-first.
update public.user_assigned_teams uat
   set is_primary = true
 where exists (
   select 1
     from public.teams t
     join public.club_staff cs on cs.user_id = uat.user_id and cs.club_id = t.club_id
    where t.id = uat.team_id and cs.role = 'coach'
 )
   and (
     select count(*) from public.user_assigned_teams u2
     join public.teams t2 on t2.id = u2.team_id
     join public.club_staff cs2 on cs2.user_id = u2.user_id and cs2.club_id = t2.club_id
     where u2.team_id = uat.team_id and cs2.role = 'coach'
   ) = 1;

comment on column public.user_assigned_teams.is_primary is
  'The team''s primary coach. At most one per team (uat_one_primary_coach_per_team). Set only via set_team_primary_coach().';

-- --------------------------------------------------------------------------
-- The permission the assignment needs
-- --------------------------------------------------------------------------
-- Deliberately team-scope, following phase6m's precedent: manage_staff is
-- scope='club', and has_staff_permission short-circuits the team fence for
-- club-scope keys -- granting manage_staff to a team manager would hand them
-- the whole club's staff, the opposite of Team Manager spec §20. A team-scope
-- key routes through the `p_team_id in current_user_team_ids()` branch, so a
-- team manager can only touch their own teams. club_manager still passes it
-- on any team via has_staff_permission's own `cs.role = 'club_manager'`
-- clause, but only because the key is in its bundle too -- that clause
-- bypasses the team fence, not the bundle check.
insert into public.permissions (key, category, scope, label, description)
values ('assign_team_staff', 'staff', 'team', 'Assign staff to a team',
        'Add or remove coaches and staff on a team you are responsible for')
on conflict (key) do nothing;

insert into public.role_permission_defaults (role, permission_key)
values ('club_manager', 'assign_team_staff'),
       ('team_manager', 'assign_team_staff')
on conflict do nothing;

-- --------------------------------------------------------------------------
-- Policies: split, because the spec's rule is DELETE-specific
-- --------------------------------------------------------------------------
drop policy if exists uat_write on public.user_assigned_teams;

create policy uat_insert on public.user_assigned_teams for insert to authenticated
with check (
  public.is_org_admin(org_id)
  or (
    -- Promotion is not an insert-time decision; it goes through
    -- set_team_primary_coach so the previous primary is demoted atomically.
    is_primary is not true
    and public.has_staff_permission(
          'assign_team_staff',
          (select t.club_id from public.teams t where t.id = team_id),
          team_id)
  )
);

create policy uat_delete on public.user_assigned_teams for delete to authenticated
using (
  public.is_org_admin(org_id)
  or (
    public.has_staff_permission(
      'assign_team_staff',
      (select t.club_id from public.teams t where t.id = team_id),
      team_id)
    -- Team Manager spec §9, now expressible: a team manager may assign and
    -- unassign coaches on their team, but the primary coach is not theirs to
    -- remove. Club-wide staff authority (manage_staff -> club_manager) is.
    and (
      is_primary is not true
      or public.has_staff_permission(
           'manage_staff',
           (select t.club_id from public.teams t where t.id = team_id),
           team_id)
    )
  )
);

-- is_primary is the only mutable column here, and it has its own RPC.
create policy uat_update on public.user_assigned_teams for update to authenticated
using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- --------------------------------------------------------------------------
-- Designating the primary coach
-- --------------------------------------------------------------------------
-- An RPC rather than a plain update because demote-then-promote has to be one
-- step: the partial unique index would reject the promote if the previous
-- primary were still standing, and a caller doing it in two statements can
-- leave the team with none.
create or replace function public.set_team_primary_coach(p_team_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_team public.teams%rowtype;
  v_role text;
  v_prev uuid;
begin
  select * into v_team from public.teams where id = p_team_id;
  if not found then
    raise exception 'team % not found', p_team_id using errcode = 'no_data_found';
  end if;
  if v_team.club_id is null then
    raise exception 'team % belongs to no club, so it has no staff to lead it', p_team_id
      using errcode = 'check_violation';
  end if;

  -- Designating the lead coach is a club-level staffing decision, not
  -- something the team manager decides for themselves (spec §9).
  if not public.has_staff_permission('manage_staff', v_team.club_id, p_team_id) then
    raise exception 'not authorised to designate this team''s primary coach'
      using errcode = 'insufficient_privilege';
  end if;

  select user_id into v_prev from public.user_assigned_teams
   where team_id = p_team_id and is_primary;

  update public.user_assigned_teams set is_primary = false
   where team_id = p_team_id and is_primary;

  -- A null target clears the designation, which a club needs when the primary
  -- coach leaves and no successor is named yet.
  if p_user_id is not null then
    select cs.role into v_role from public.club_staff cs
     where cs.user_id = p_user_id and cs.club_id = v_team.club_id;

    if v_role is null then
      raise exception 'that person is not staff at this club' using errcode = 'no_data_found';
    end if;
    -- assistant_coach is deliberately excluded: the point of the role is that
    -- it supports a lead coach rather than being one.
    if v_role <> 'coach' then
      raise exception 'the primary coach must hold the coach role, not %', v_role
        using errcode = 'check_violation';
    end if;

    update public.user_assigned_teams set is_primary = true
     where team_id = p_team_id and user_id = p_user_id;
    if not found then
      raise exception 'that coach is not assigned to this team yet' using errcode = 'no_data_found';
    end if;
  end if;

  perform public.write_audit(v_team.org_id, 'team.primary_coach.changed',
    'club', v_team.club_id, 'team', p_team_id::text,
    jsonb_build_object('user_id', v_prev),
    jsonb_build_object('user_id', p_user_id));
end $$;

-- phase6s: EXECUTE defaults to PUBLIC on creation, and anon inherits PUBLIC.
revoke all on function public.set_team_primary_coach(uuid, uuid) from public;
revoke all on function public.set_team_primary_coach(uuid, uuid) from anon;
grant execute on function public.set_team_primary_coach(uuid, uuid) to authenticated;
grant execute on function public.set_team_primary_coach(uuid, uuid) to service_role;
