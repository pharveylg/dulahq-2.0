-- Secretary: entry documents (waivers, insurance, roster forms), the last club-analog
-- role left with no consumer (manage_tournament_documents, since phase8). Files live in R2
-- (the 'documents' category in shared/files/lib/r2.ts, unused until now); the row stores
-- only the key. A team contact uploads through the portal; a manage_tournament_documents
-- holder or org admin reviews -- never the uploader's own team, so a team can't wave its
-- own paperwork through.

create table if not exists public.tournament_entry_documents (
  id              uuid primary key default gen_random_uuid(),
  entry_id        uuid not null references public.tournament_entries(id) on delete cascade,
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  org_id          uuid not null references public.organizations(id) on delete cascade,
  type            text not null check (type in ('waiver', 'insurance', 'roster_form', 'other')),
  name            text not null check (length(btrim(name)) > 0),
  storage_key     text not null,
  file_name       text,
  mime_type       text,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note     text,
  reviewed_by     uuid references public.users(id) on delete set null,
  reviewed_by_role text,
  reviewed_at     timestamptz,
  uploaded_by     uuid references public.users(id) on delete set null,
  uploaded_by_role text,
  created_at      timestamptz not null default now()
);
create index if not exists tournament_entry_documents_entry_idx on public.tournament_entry_documents (entry_id, created_at desc);
alter table public.tournament_entry_documents enable row level security;
revoke all on public.tournament_entry_documents from anon;
revoke insert, update, delete, truncate on public.tournament_entry_documents from authenticated;

-- Staff read directly (a review screen needs a normal select); entrants read only through
-- entrant_entry_portal(), same split as billing and notes.
create policy tournament_entry_documents_read on public.tournament_entry_documents for select to authenticated
using (public.is_org_admin(org_id) or public.has_tournament_permission('manage_tournament_documents', tournament_id));

create policy org_not_suspended on public.tournament_entry_documents as restrictive for all to authenticated
using (public.org_access_allowed(org_id)) with check (public.org_access_allowed(org_id));

create or replace function public.submit_entry_document(
  p_entry_id uuid, p_type text, p_name text, p_storage_key text, p_file_name text, p_mime_type text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_entry public.tournament_entries%rowtype; v_role text; v_id uuid;
begin
  if p_type not in ('waiver', 'insurance', 'roster_form', 'other') then
    raise exception 'unknown document type' using errcode = 'check_violation';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'give the document a name' using errcode = 'check_violation';
  end if;
  if p_storage_key is null or length(btrim(p_storage_key)) = 0 then
    raise exception 'no file was uploaded' using errcode = 'check_violation';
  end if;
  select * into v_entry from public.tournament_entries where id = p_entry_id;
  if not found or not public.is_tournament_entry_contact(p_entry_id) or not public.org_access_allowed(v_entry.host_org_id) then
    raise exception 'no access to this entry' using errcode = 'insufficient_privilege';
  end if;
  select tec.role into v_role from public.tournament_entry_contacts tec
   where tec.entry_id = p_entry_id and tec.user_id = auth.uid() and tec.account_status = 'active' limit 1;
  insert into public.tournament_entry_documents (entry_id, tournament_id, org_id, type, name, storage_key, file_name, mime_type, uploaded_by, uploaded_by_role)
  values (p_entry_id, v_entry.tournament_id, v_entry.host_org_id, p_type, btrim(p_name), p_storage_key, p_file_name, p_mime_type, auth.uid(), v_role)
  returning id into v_id;
  perform public.write_audit_system(v_entry.host_org_id, 'tournament.document.uploaded', 'tournament', v_entry.tournament_id,
    'tournament_entry_document', v_id::text, null, jsonb_build_object('entry_id', p_entry_id, 'type', p_type, 'name', btrim(p_name)));
  return v_id;
end $$;

-- A secretary/organizer/org admin recording a document a team sent in some other way
-- (an emailed scan, a paper form). Still reviewed separately, by anyone with the
-- permission -- the person who uploaded it need not be the one who approves it.
create or replace function public.staff_upload_entry_document(
  p_entry_id uuid, p_type text, p_name text, p_storage_key text, p_file_name text, p_mime_type text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_entry public.tournament_entries%rowtype; v_id uuid;
begin
  if p_type not in ('waiver', 'insurance', 'roster_form', 'other') then
    raise exception 'unknown document type' using errcode = 'check_violation';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'give the document a name' using errcode = 'check_violation';
  end if;
  if p_storage_key is null or length(btrim(p_storage_key)) = 0 then
    raise exception 'no file was uploaded' using errcode = 'check_violation';
  end if;
  select * into v_entry from public.tournament_entries where id = p_entry_id;
  if not found then raise exception 'entry not found' using errcode = 'no_data_found'; end if;
  if not (public.is_org_admin(v_entry.host_org_id) or public.has_tournament_permission('manage_tournament_documents', v_entry.tournament_id)) then
    raise exception 'you cannot manage documents for this tournament' using errcode = 'insufficient_privilege';
  end if;
  insert into public.tournament_entry_documents (entry_id, tournament_id, org_id, type, name, storage_key, file_name, mime_type, uploaded_by, uploaded_by_role)
  values (p_entry_id, v_entry.tournament_id, v_entry.host_org_id, p_type, btrim(p_name), p_storage_key, p_file_name, p_mime_type, auth.uid(), 'staff')
  returning id into v_id;
  perform public.write_audit_system(v_entry.host_org_id, 'tournament.document.uploaded', 'tournament', v_entry.tournament_id,
    'tournament_entry_document', v_id::text, null, jsonb_build_object('entry_id', p_entry_id, 'type', p_type, 'name', btrim(p_name), 'by', 'staff'));
  return v_id;
end $$;

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
    perform public.create_notification(d.org_id, d.uploaded_by, null, 'in_app', 'tournament.document.reviewed',
      jsonb_build_object('title', case when p_status = 'approved' then 'Document approved' else 'Document needs attention' end,
                          'body', d.name), '/entry/' || d.entry_id);
  end if;
end $$;

-- The uploader may take back a mistake before anyone has looked at it; once reviewed the
-- record stands. A review holder can remove any document at any time.
create or replace function public.delete_entry_document(p_document_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare d public.tournament_entry_documents%rowtype;
begin
  select * into d from public.tournament_entry_documents where id = p_document_id;
  if not found then raise exception 'document not found' using errcode = 'no_data_found'; end if;
  if not (
    public.is_org_admin(d.org_id)
    or public.has_tournament_permission('manage_tournament_documents', d.tournament_id)
    or (d.uploaded_by = auth.uid() and d.status = 'pending')
  ) then
    raise exception 'you cannot remove this document' using errcode = 'insufficient_privilege';
  end if;
  delete from public.tournament_entry_documents where id = p_document_id;
  perform public.write_audit_system(d.org_id, 'tournament.document.deleted', 'tournament', d.tournament_id,
    'tournament_entry_document', p_document_id::text, null, jsonb_build_object('entry_id', d.entry_id, 'name', d.name));
  return d.storage_key;
end $$;

-- The portal (phase15a/15c) gains this entry's documents.
create or replace function public.entrant_entry_portal(p_entry_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_entry record;
  v_role text;
  v_account record;
begin
  select te.id, te.team_name, te.status, te.host_org_id, te.tournament_id, t.name as tournament_name,
         o.name as host_org_name, tc.name as category_name
    into v_entry
    from public.tournament_entries te
    join public.tournaments t on t.id = te.tournament_id
    join public.organizations o on o.id = te.host_org_id
    left join public.tournament_categories tc on tc.id = te.category_id
   where te.id = p_entry_id;
  if not found or not public.is_tournament_entry_contact(p_entry_id) or not public.org_access_allowed(v_entry.host_org_id) then
    raise exception 'no access to this entry' using errcode = 'insufficient_privilege';
  end if;
  select tec.role into v_role from public.tournament_entry_contacts tec
   where tec.entry_id = p_entry_id and tec.user_id = auth.uid() and tec.account_status = 'active' limit 1;

  select ba.payment_instructions, ba.qr_storage_key into v_account
    from public.billing_accounts ba
   where ba.tournament_id = v_entry.tournament_id and ba.context_type = 'tournament';

  return jsonb_build_object(
    'entry', jsonb_build_object('id', v_entry.id, 'team_name', v_entry.team_name, 'status', v_entry.status,
             'tournament_name', v_entry.tournament_name, 'host_org_name', v_entry.host_org_name,
             'category_name', v_entry.category_name),
    'my_role', v_role,
    'instructions', v_account.payment_instructions,
    'qr_storage_key', v_account.qr_storage_key,
    'announcements', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body,
               'author_name', a.author_name, 'created_at', a.created_at) order by a.created_at desc)
        from (select * from public.tournament_announcements a
               where a.tournament_id = v_entry.tournament_id and a.retracted_at is null
                 and v_entry.status in ('pending', 'accepted')
                 and (a.audience = 'all' or v_entry.status = 'accepted')
               order by a.created_at desc limit 20) a), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'type', d.type, 'name', d.name, 'status', d.status,
               'review_note', d.review_note, 'uploaded_by_role', d.uploaded_by_role, 'created_at', d.created_at)
               order by d.created_at desc)
        from public.tournament_entry_documents d where d.entry_id = p_entry_id), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'invoice_number', i.invoice_number, 'status', i.status, 'currency', i.currency,
               'total', i.total, 'amount_paid', i.amount_paid, 'due_at', i.due_at,
               'pending_amount', coalesce((select sum(s.amount) from public.billing_payment_submissions s
                                            where s.invoice_id = i.id and s.status in ('submitted', 'under_review')), 0),
               'submissions', coalesce((select jsonb_agg(jsonb_build_object(
                                 'id', s.id, 'amount', s.amount, 'status', s.status, 'method', s.method,
                                 'reference_number', s.reference_number, 'reviewer_note', s.reviewer_note,
                                 'submitted_at', s.submitted_at) order by s.submitted_at desc)
                                 from public.billing_payment_submissions s where s.invoice_id = i.id), '[]'::jsonb))
             order by i.created_at desc)
        from public.billing_invoices i
       where i.source_type = 'tournament_entry' and i.source_id = p_entry_id::text
         and i.status <> 'draft'), '[]'::jsonb)
  );
end $$;

revoke all on function public.submit_entry_document(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.staff_upload_entry_document(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.review_entry_document(uuid, text, text) from public, anon;
revoke all on function public.delete_entry_document(uuid) from public, anon;
revoke all on function public.entrant_entry_portal(uuid) from public, anon;
grant execute on function public.submit_entry_document(uuid, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.staff_upload_entry_document(uuid, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.review_entry_document(uuid, text, text) to authenticated, service_role;
grant execute on function public.delete_entry_document(uuid) to authenticated, service_role;
grant execute on function public.entrant_entry_portal(uuid) to authenticated, service_role;
