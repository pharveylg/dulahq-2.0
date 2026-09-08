-- Phase 5d (CLAUDE.md §0c): document_uploads has existed since the player-
-- development-module migration with zero application code ever touching
-- it, and its RLS predates Phase 0's permission catalog -- write was
-- can_admin_club() only (club_admin exclusively, no staff role at all,
-- even though role_permission_defaults already seeds 'manage_documents'
-- for both club_admin AND staff), and read let ANY guardian/player-self
-- through unconditionally with no per-relationship permission gate (every
-- other player-scoped table cut over to has_guardian_permission() back in
-- phase6b/6c). Cutting document_uploads over to the same catalog entries
-- Phase 0 already defined for it (view_documents, manage_documents) but
-- left unused until this phase actually builds the feature.

drop policy if exists docs_read on public.document_uploads;
drop policy if exists docs_write on public.document_uploads;

create policy docs_read on public.document_uploads for select to authenticated
  using (
    is_org_member(org_id) and (
      is_player_self(player_id)
      or (player_id is not null and public.has_guardian_permission('view_documents', player_id))
      or exists (
        select 1 from public.teams t
        where t.id = document_uploads.team_id
          and public.has_staff_permission('manage_documents', t.club_id)
      )
    )
  );

create policy docs_write on public.document_uploads for all to authenticated
  using (
    is_org_member(org_id) and exists (
      select 1 from public.teams t
      where t.id = document_uploads.team_id
        and public.has_staff_permission('manage_documents', t.club_id)
    )
  )
  with check (
    is_org_member(org_id) and exists (
      select 1 from public.teams t
      where t.id = document_uploads.team_id
        and public.has_staff_permission('manage_documents', t.club_id)
    )
  );
