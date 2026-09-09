-- Phase: broaden documents beyond tournament-only, with per-category staff
-- visibility (CLAUDE.md §0c). Phase 5d's docs_read/docs_write gated every
-- document type identically on manage_documents (club_admin/staff only).
-- Reusing view_medical -- already in Phase 0's catalog, already defaulted
-- to club_admin + coach + team_manager, unused until now -- lets medical
-- documents be visible to the assigned coaching staff who actually need
-- to know about a clearance or allergy, while identity/registration/
-- consent documents (birth certificates, signed waivers) stay on
-- manage_documents as before -- more administrative/sensitive, no reason
-- to widen those.

alter table public.document_uploads add column if not exists category text not null default 'other';

update public.document_uploads set category = case
  when type in ('birth_certificate','government_id') then 'identity'
  when type in ('medical_clearance','allergy_disclosure','insurance_card') then 'medical'
  when type = 'registration' then 'registration'
  when type in ('code_of_conduct','consent_form','media_consent','tournament_waiver') then 'consent'
  else 'other'
end;

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
          and (
            (document_uploads.category = 'medical' and public.has_staff_permission('view_medical', t.club_id, document_uploads.team_id))
            or public.has_staff_permission('manage_documents', t.club_id)
          )
      )
    )
  );

create policy docs_write on public.document_uploads for all to authenticated
  using (
    is_org_member(org_id) and exists (
      select 1 from public.teams t
      where t.id = document_uploads.team_id
        and (
          (document_uploads.category = 'medical' and public.has_staff_permission('view_medical', t.club_id, document_uploads.team_id))
          or public.has_staff_permission('manage_documents', t.club_id)
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
        )
    )
  );
