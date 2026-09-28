-- review_entry_document called create_notification(), which checks is_org_member() on the
-- CALLER before inserting -- meant for a client-side caller acting on their own org
-- membership. A secretary or organizer is tournament staff, not an org member (is_org_member
-- has no tournament_staff branch), so reviewing a team-uploaded document raised
-- 'not a member of this organization' and rolled back the whole review. Same trap class as
-- phase5c's RETURNING-triggers-a-read-check bug: review_entry_document is already a checked
-- SECURITY DEFINER function, so -- like post_tournament_announcement -- it should insert the
-- notification directly rather than go through a second, differently-scoped check.

create or replace function public.review_entry_document(p_document_id uuid, p_status text, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare d public.tournament_entry_documents%rowtype; v_role_name text;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'status must be approved or rejected' using errcode = 'check_violation';
  end if;
  if p_status = 'rejected' and (p_note is null or length(btrim(p_note)) = 0) then
    raise exception 'say why it was rejected so the team knows what to fix' using errcode = 'check_violation';
  end if;
  select * into d from public.tournament_entry_documents where id = p_document_id;
  if not found then raise exception 'document not found' using errcode = 'no_data_found'; end if;
  if not (public.is_org_admin(d.org_id) or public.has_tournament_permission('manage_tournament_documents', d.tournament_id)) then
    raise exception 'you cannot review documents for this tournament' using errcode = 'insufficient_privilege';
  end if;
  select coalesce(nullif(btrim(name), ''), email) into v_role_name from public.users where id = auth.uid();
  update public.tournament_entry_documents
     set status = p_status, review_note = nullif(btrim(p_note), ''), reviewed_by = auth.uid(),
         reviewed_by_role = v_role_name, reviewed_at = now()
   where id = p_document_id;
  perform public.write_audit_system(d.org_id,
    case when p_status = 'approved' then 'tournament.document.approved' else 'tournament.document.rejected' end,
    'tournament', d.tournament_id, 'tournament_entry_document', p_document_id::text, null,
    jsonb_build_object('entry_id', d.entry_id, 'name', d.name));
  if d.uploaded_by is not null and d.uploaded_by_role <> 'staff' then
    insert into public.notifications (org_id, recipient_user_id, channel, template, payload, link_path)
    values (d.org_id, d.uploaded_by, 'in_app', 'tournament.document.reviewed',
            jsonb_build_object('title', case when p_status = 'approved' then 'Document approved' else 'Document needs attention' end,
                                'body', d.name), '/entry/' || d.entry_id);
  end if;
end $$;

revoke all on function public.review_entry_document(uuid, text, text) from public, anon;
grant execute on function public.review_entry_document(uuid, text, text) to authenticated, service_role;
