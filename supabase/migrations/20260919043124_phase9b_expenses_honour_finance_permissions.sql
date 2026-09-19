-- Gap analysis 2026-09-11, Clubs 2.3. phase6m wired manage_finances /
-- view_finances into fee_charges, payments and memberships and missed
-- expenses, which stayed can_admin_club / can_read_club only. So the
-- `treasurer` role (created in phase6l as the finance specialist) and the
-- `staff` role (which has nominally held manage_finances since
-- widen_fee_management_to_staff_role) could manage fee charges but not
-- record a single expense. Same shape as fees_read / fees_write.
drop policy if exists expenses_read on public.expenses;
create policy expenses_read on public.expenses for select to authenticated
using (
  public.can_read_club(org_id, club_id)
  or public.has_staff_permission('view_finances', club_id)
  or public.has_staff_permission('manage_finances', club_id)
);

drop policy if exists expenses_write on public.expenses;
create policy expenses_write on public.expenses for all to authenticated
using (
  public.can_admin_club(org_id, club_id)
  or public.has_staff_permission('manage_finances', club_id)
)
with check (
  public.can_admin_club(org_id, club_id)
  or public.has_staff_permission('manage_finances', club_id)
);
