-- Phase E foundation (CLAUDE.md §0d): the IT administration role the Club
-- Admin spec describes -- deliberately named club_it_admin, NOT club_admin,
-- because every historical migration here reads 'club_admin' as the old
-- god-mode business role (see phase6k).
--
-- The defining property of this role is what it does NOT get: no business
-- permission of any kind. It holds only technical keys. It must not satisfy
-- is_club_manager() (it doesn't -- that checks role='club_manager'), and it
-- must not pick up business access through any "any club_staff row" style
-- check. One such check existed and is closed below.

alter table public.club_staff drop constraint club_staff_role_check;
alter table public.role_permission_defaults drop constraint role_permission_defaults_role_check;

alter table public.club_staff add constraint club_staff_role_check
  check (role = any (array['club_manager','staff','coach','team_manager','assistant_coach','treasurer','secretary','club_it_admin']));
alter table public.role_permission_defaults add constraint role_permission_defaults_role_check
  check (role = any (array['club_manager','staff','coach','team_manager','assistant_coach','treasurer','secretary','club_it_admin']));

-- ---------- technical permission keys ----------
insert into public.permissions (key, category, scope, label, description) values
  ('view_audit_log', 'staff', 'club', 'View audit log',
   'Review administrative and security activity for the club'),
  ('impersonate_user', 'staff', 'club', 'View as another user',
   'Start a logged, time-limited session to inspect another user''s effective access for troubleshooting')
on conflict (key) do nothing;

delete from public.role_permission_defaults where role = 'club_it_admin';
insert into public.role_permission_defaults (role, permission_key) values
  ('club_it_admin','view_audit_log'),
  ('club_it_admin','impersonate_user');

-- The club manager oversees IT administration (Club Admin spec §26) and so
-- can review the audit trail, but does NOT get impersonate_user by default:
-- spec §27's "Club Manager = highest business authority, technical
-- administration is separate" cuts both ways.
insert into public.role_permission_defaults (role, permission_key) values
  ('club_manager','view_audit_log')
on conflict do nothing;

-- ---------- close the "any club_staff row" guardian-write hole ----------
-- pg_write granted guardian linking to is_club_staff(club_id), which checks
-- neither role nor team -- the same class of bug phase2j/phase2k fixed for
-- can_read_club. Harmless while every club_staff role was a business role;
-- actively wrong now that club_it_admin exists, since the Club Admin spec
-- §11 says the IT role gets no Player Profile access. Swapped for the
-- permission every business role already holds and the IT role does not.
drop policy if exists pg_write on public.player_guardians;
create policy pg_write on public.player_guardians for all to authenticated
  using (
    is_staff_in_org(org_id) and exists (
      select 1 from public.players p join public.teams t on t.id = p.team_id
      where p.id = player_guardians.player_id
        and (
          can_admin_club(player_guardians.org_id, t.club_id)
          or public.has_staff_permission('view_player', t.club_id, t.id)
        )
    )
  )
  with check (
    is_staff_in_org(org_id) and exists (
      select 1 from public.players p join public.teams t on t.id = p.team_id
      where p.id = player_guardians.player_id
        and (
          can_admin_club(player_guardians.org_id, t.club_id)
          or public.has_staff_permission('view_player', t.club_id, t.id)
        )
    )
  );
