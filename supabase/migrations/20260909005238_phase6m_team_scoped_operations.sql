-- Phase B (CLAUDE.md §0d): give Team Manager real operational reach over
-- assigned teams -- finance visibility, documents, membership -- without
-- club-wide leakage.
--
-- Why new keys rather than just adding manage_documents/manage_membership/
-- view_finances to the team_manager bundle: those are all scope='club', and
-- has_staff_permission() short-circuits the team fence for club-scope keys
-- (`perm.scope = 'club' or ...`). Granting them to team_manager would hand
-- over the whole club, which is precisely what the Team Manager spec §20
-- forbids ("Scope financial access to Assigned Teams only... must not
-- automatically receive club-wide financial access"). Team-scope keys route
-- through the `p_team_id in current_user_team_ids()` branch instead.
--
-- This migration also fixes a live gap it would otherwise sit on top of:
-- fee_charges / payments / memberships RLS was gated purely on
-- can_read_club / can_admin_club (club_manager or org_admin), so the
-- club-scope manage_finances / view_finances / manage_membership keys were
-- never consulted by any policy -- the `staff` role has held
-- manage_finances since `widen_fee_management_to_staff_role` without the
-- database ever honouring it. (can_create_fees() is referenced by zero
-- policies and stays dead; not resurrected here.)

insert into public.permissions (key, category, scope, label, description) values
  ('view_team_finance', 'staff', 'team', 'View team finances',
   'View fee status, balances and financial summaries for an assigned team'),
  ('manage_team_documents', 'staff', 'team', 'Manage team documents',
   'Upload and review documents for players on an assigned team'),
  ('manage_team_membership', 'staff', 'team', 'Manage team membership',
   'Manage registration and membership status for players on an assigned team')
on conflict (key) do nothing;

insert into public.role_permission_defaults (role, permission_key) values
  ('team_manager','view_team_finance'),
  ('team_manager','manage_team_documents'),
  ('team_manager','manage_team_membership')
on conflict do nothing;

-- ---------- fee_charges: read-only for the team manager ----------
-- The Team Manager spec's finance permissions are all VIEW_/EXPORT_ (§23);
-- raising and editing charges stays club-scope (club_manager, staff,
-- treasurer via manage_finances).
drop policy if exists fees_read on public.fee_charges;
create policy fees_read on public.fee_charges for select to authenticated
  using (
    is_org_member(org_id) and (
      can_read_club(org_id, club_id)
      or public.has_staff_permission('view_finances', club_id)
      or exists (
        select 1 from public.players p
        where p.id = fee_charges.player_id
          and public.has_staff_permission('view_team_finance', fee_charges.club_id, p.team_id)
      )
      or is_guardian_of(player_id)
      or is_player_self(player_id)
    )
  );

drop policy if exists fees_write on public.fee_charges;
create policy fees_write on public.fee_charges for all to authenticated
  using (can_admin_club(org_id, club_id) or public.has_staff_permission('manage_finances', club_id))
  with check (can_admin_club(org_id, club_id) or public.has_staff_permission('manage_finances', club_id));

-- ---------- payments: follow the charge ----------
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated
  using (
    is_org_member(org_id) and exists (
      select 1 from public.fee_charges f
      where f.id = payments.fee_charge_id
        and (
          can_read_club(f.org_id, f.club_id)
          or public.has_staff_permission('view_finances', f.club_id)
          or exists (
            select 1 from public.players p
            where p.id = f.player_id
              and public.has_staff_permission('view_team_finance', f.club_id, p.team_id)
          )
          or is_guardian_of(f.player_id)
          or is_player_self(f.player_id)
        )
    )
  );

drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments for all to authenticated
  using (
    is_org_member(org_id) and exists (
      select 1 from public.fee_charges f
      where f.id = payments.fee_charge_id
        and (can_admin_club(f.org_id, f.club_id) or public.has_staff_permission('manage_finances', f.club_id))
    )
  )
  with check (
    is_org_member(org_id) and exists (
      select 1 from public.fee_charges f
      where f.id = payments.fee_charge_id
        and (can_admin_club(f.org_id, f.club_id) or public.has_staff_permission('manage_finances', f.club_id))
    )
  );

-- ---------- memberships: read + write for the assigned team ----------
-- Team Manager spec §19/§23 grants MANAGE_TEAM_MEMBERSHIP_STATUS, so unlike
-- finance this one is not read-only.
drop policy if exists memberships_read on public.memberships;
create policy memberships_read on public.memberships for select to authenticated
  using (
    is_org_member(org_id) and (
      can_read_club(org_id, club_id)
      or public.has_staff_permission('manage_membership', club_id)
      or exists (
        select 1 from public.players p
        where p.id = memberships.player_id
          and public.has_staff_permission('manage_team_membership', memberships.club_id, p.team_id)
      )
      or is_guardian_of(player_id)
      or is_player_self(player_id)
    )
  );

drop policy if exists memberships_write on public.memberships;
create policy memberships_write on public.memberships for all to authenticated
  using (
    can_admin_club(org_id, club_id)
    or public.has_staff_permission('manage_membership', club_id)
    or exists (
      select 1 from public.players p
      where p.id = memberships.player_id
        and public.has_staff_permission('manage_team_membership', memberships.club_id, p.team_id)
    )
  )
  with check (
    can_admin_club(org_id, club_id)
    or public.has_staff_permission('manage_membership', club_id)
    or exists (
      select 1 from public.players p
      where p.id = memberships.player_id
        and public.has_staff_permission('manage_team_membership', memberships.club_id, p.team_id)
    )
  );

-- ---------- document_uploads: add the team-scoped branch ----------
-- Keeps phase6j's category split intact (medical -> view_medical), and adds
-- manage_team_documents alongside the club-scope manage_documents.
drop policy if exists docs_read on public.document_uploads;
create policy docs_read on public.document_uploads for select to authenticated
  using (
    is_org_member(org_id) and (
      is_player_self(player_id)
      or (player_id is not null and public.has_guardian_permission('view_documents', player_id))
      or exists (
        select 1 from public.teams t
        where t.id = document_uploads.team_id
          and (
            (document_uploads.category = 'medical' and public.has_staff_permission('view_medical', t.club_id, document_uploads.team_id))
            or public.has_staff_permission('manage_documents', t.club_id)
            or public.has_staff_permission('manage_team_documents', t.club_id, document_uploads.team_id)
          )
      )
    )
  );

drop policy if exists docs_write on public.document_uploads;
create policy docs_write on public.document_uploads for all to authenticated
  using (
    is_org_member(org_id) and exists (
      select 1 from public.teams t
      where t.id = document_uploads.team_id
        and (
          (document_uploads.category = 'medical' and public.has_staff_permission('view_medical', t.club_id, document_uploads.team_id))
          or public.has_staff_permission('manage_documents', t.club_id)
          or public.has_staff_permission('manage_team_documents', t.club_id, document_uploads.team_id)
        )
    )
  )
  with check (
    is_org_member(org_id) and exists (
      select 1 from public.teams t
      where t.id = document_uploads.team_id
        and (
          (document_uploads.category = 'medical' and public.has_staff_permission('view_medical', t.club_id, document_uploads.team_id))
          or public.has_staff_permission('manage_documents', t.club_id)
          or public.has_staff_permission('manage_team_documents', t.club_id, document_uploads.team_id)
        )
    )
  );
