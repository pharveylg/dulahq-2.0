-- Phase A of the role realignment (CLAUDE.md §0d). The uploaded role specs
-- define "Club Admin" as an IT-only role with zero business authority, while
-- this codebase's `club_admin` is the club's business boss holding all 26
-- permissions and anchoring the RLS spine (is_club_admin -> can_read_club /
-- can_admin_club). Those are opposite meanings for the same string, so the
-- existing role is renamed to what it actually is -- club_manager -- freeing
-- the concept for a separate IT role later (to be named club_it_admin, NOT
-- club_admin: every historical migration in this repo will forever read
-- 'club_admin' as god-mode, and recycling the string invites exactly the
-- confusion this rename exists to remove).
--
-- The org layer above (organizations / org_members / is_org_admin) is
-- deliberately NOT renamed to org_manager: it already means something
-- different and broader (a tenant owning multiple clubs plus tournament
-- entitlements), and it is what the specs' contradictory "Club Director"
-- tier maps onto. See §0d for that reasoning.

-- ---------- 1. data first, so no row ever carries the old meaning ----------
alter table public.club_staff drop constraint club_staff_role_check;
alter table public.role_permission_defaults drop constraint role_permission_defaults_role_check;

update public.club_staff set role = 'club_manager' where role = 'club_admin';
update public.role_permission_defaults set role = 'club_manager' where role = 'club_admin';
update public.role_assignments set role = 'club_manager' where role = 'club_admin' and scope_type = 'club';

alter table public.club_staff add constraint club_staff_role_check
  check (role = any (array['club_manager','staff','coach','team_manager','assistant_coach','treasurer','secretary']));
alter table public.role_permission_defaults add constraint role_permission_defaults_role_check
  check (role = any (array['club_manager','staff','coach','team_manager','assistant_coach','treasurer','secretary']));

-- ---------- 2. the helper, re-pointed ----------
create or replace function public.is_club_manager(check_club_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.role_assignments ra
                 where ra.user_id = auth.uid()
                   and ra.scope_type = 'club' and ra.scope_id = check_club_id
                   and ra.role = 'club_manager')
      or exists (select 1 from public.club_staff cs
                 where cs.club_id = check_club_id and cs.user_id = auth.uid()
                   and cs.role = 'club_manager')
      or public.is_platform_admin();
$$;

revoke all on function public.is_club_manager(uuid) from public;
revoke all on function public.is_club_manager(uuid) from anon;
grant execute on function public.is_club_manager(uuid) to authenticated;

create or replace function public.can_admin_club(p_org uuid, p_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_club_manager(p_club) or public.is_org_admin(p_org);
$$;

create or replace function public.can_read_club(p_org uuid, p_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_club_manager(p_club) or public.is_org_admin(p_org);
$$;

-- has_staff_permission's club-wide bypass keyed on the old role name
create or replace function public.has_staff_permission(p_permission_key text, p_club_id uuid, p_team_id uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.club_staff cs
      join public.permissions perm on perm.key = p_permission_key
      where cs.club_id = p_club_id
        and cs.user_id = auth.uid()
        -- team-scoped permissions additionally require the acting team to
        -- be one this person is assigned to, unless they're club_manager
        -- (club-wide by role) -- mirrors today's canManage logic exactly.
        and (
          perm.scope = 'club'
          or cs.role = 'club_manager'
          or (p_team_id is not null and p_team_id in (select public.current_user_team_ids()))
        )
        and (
          -- explicit revoke always wins
          not exists (
            select 1 from public.staff_permission_grants g
            where g.club_id = p_club_id and g.user_id = auth.uid() and g.permission_key = p_permission_key
              and g.granted = false and (g.team_id is null or g.team_id = p_team_id)
          )
        )
        and (
          -- explicit grant, or the role's default bundle includes it
          exists (
            select 1 from public.staff_permission_grants g
            where g.club_id = p_club_id and g.user_id = auth.uid() and g.permission_key = p_permission_key
              and g.granted = true and (g.team_id is null or g.team_id = p_team_id)
          )
          or exists (
            select 1 from public.role_permission_defaults d
            where d.role = cs.role and d.permission_key = p_permission_key
          )
        )
    );
$$;

-- ---------- 3. the four policies that name is_club_admin directly ----------
drop policy if exists "guardian_permission_grants read: the guardian or club admin" on public.guardian_permission_grants;
create policy "guardian_permission_grants read: the guardian or club manager"
  on public.guardian_permission_grants for select to authenticated
  using (
    exists (select 1 from public.player_guardians pg join public.guardians g on g.id = pg.guardian_id
            where pg.id = guardian_permission_grants.player_guardian_id and g.user_id = auth.uid())
    or exists (select 1 from public.player_guardians pg join public.players p on p.id = pg.player_id
               where pg.id = guardian_permission_grants.player_guardian_id
                 and (public.is_club_manager(p.club_id) or public.is_platform_admin()))
  );

drop policy if exists "guardian_permission_grants write: club admin only" on public.guardian_permission_grants;
create policy "guardian_permission_grants write: club manager only"
  on public.guardian_permission_grants for all to authenticated
  using (
    exists (select 1 from public.player_guardians pg join public.players p on p.id = pg.player_id
            where pg.id = guardian_permission_grants.player_guardian_id
              and (public.is_club_manager(p.club_id) or public.is_platform_admin()))
  )
  with check (
    exists (select 1 from public.player_guardians pg join public.players p on p.id = pg.player_id
            where pg.id = guardian_permission_grants.player_guardian_id
              and (public.is_club_manager(p.club_id) or public.is_platform_admin()))
  );

drop policy if exists "staff_permission_grants read: self or club admin" on public.staff_permission_grants;
create policy "staff_permission_grants read: self or club manager"
  on public.staff_permission_grants for select to authenticated
  using (user_id = auth.uid() or public.is_club_manager(club_id) or public.is_platform_admin());

drop policy if exists "staff_permission_grants write: club admin only" on public.staff_permission_grants;
create policy "staff_permission_grants write: club manager only"
  on public.staff_permission_grants for all to authenticated
  using (public.is_club_manager(club_id) or public.is_platform_admin())
  with check (public.is_club_manager(club_id) or public.is_platform_admin());

-- Nothing may reference the old helper by now; the drop fails loudly if it
-- does, which is the point of dropping rather than redefining in place.
drop function if exists public.is_club_admin(uuid);
