-- Found while verifying P0-6 (club profile editing) live as the club
-- manager: "You don't have permission to do that" on a plain club rename --
-- a feature that predates this whole batch. clubs_admin_write's USING
-- clause correctly reads `can_admin_club(org_id, id)` (club_manager OR
-- org_admin), but its WITH CHECK narrowed to `is_org_admin(org_id) AND
-- org_has_product(...)` -- dropping the club_manager branch entirely. USING
-- and WITH CHECK on the same UPDATE policy describe the same intent (who
-- may touch this row), so this asymmetry was never intentional: it meant
-- the "Rename" button has silently never worked for a club_manager, only
-- for an org_admin, since clubs_admin_write was written.
drop policy if exists clubs_admin_write on public.clubs;

create policy clubs_admin_write on public.clubs for all to authenticated
using (public.can_admin_club(org_id, id))
with check (public.can_admin_club(org_id, id) and public.org_has_product(org_id, 'club'));
