-- Phase 16m: push-enable tournament announcements and document reviews, and widen
-- create_notification()'s authorization check to cover tournament staff.
--
-- Reconstructed from the live project's current function definitions, not committed
-- at the time it was applied. The live project recorded four incremental
-- apply_migration calls that day (phase16m, phase16m_v2,
-- phase16m_fix_create_notification_and_review_entry_document, phase16m_v3_jsonb_return_shape)
-- -- this single file captures their net, final effect rather than each intermediate
-- step, the same reconstruction approach already used for phase2h/phase2i (see
-- CLAUDE.md §0a). Verified byte-for-byte against pg_get_functiondef() on
-- 2026-10-02, immediately before phase16o superseded these same three functions.

-- create_notification() checked is_org_member(p_org_id) -- no tournament_staff
-- branch -- so a referee coordinator or other tournament-scoped notifier calling
-- it on their own behalf (via notifyUser()) was refused "not a member of this
-- organization". Widened to is_user_in_org(auth.uid(), p_org_id), a verified
-- strict superset (role_assignments/org_members/club_staff/user_assigned_teams/
-- guardians/players, PLUS tournament_staff/tournament_entry_contacts) -- nothing
-- that passed the narrower check can ever fail the broader one.
create or replace function public.create_notification(
  p_org_id uuid,
  p_recipient_user_id uuid,
  p_recipient_guardian_id uuid,
  p_channel text,
  p_template text,
  p_payload jsonb,
  p_link_path text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_user_in_org(auth.uid(), p_org_id) then
    raise exception 'not a member of this organization';
  end if;

  insert into public.notifications (org_id, recipient_user_id, recipient_guardian_id, channel, template, payload, link_path)
  values (p_org_id, p_recipient_user_id, p_recipient_guardian_id, p_channel, p_template, p_payload, p_link_path)
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.create_notification(uuid, uuid, uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.create_notification(uuid, uuid, uuid, text, text, jsonb, text) to authenticated, service_role;

-- post_tournament_announcement() returns jsonb instead of uuid so the announcement's
-- own id survives even when zero entrants are currently addressable (a RETURNS TABLE
-- shape loses the scalar entirely on zero rows). 'recipients' carries enough per-row
-- detail (recipient_user_id, notification_id, link_path) for the caller to dispatch
-- push without a second query -- phase16o later simplifies this to a flat id array,
-- since the per-recipient detail was never actually consumed.
drop function if exists public.post_tournament_announcement(uuid, text, text, text);
create function public.post_tournament_announcement(
  p_tournament_id uuid,
  p_title text,
  p_body text,
  p_audience text default 'all'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_t public.tournaments%rowtype;
  v_id uuid;
  v_name text;
  r record;
  v_notif_id uuid;
  v_recipients jsonb := '[]'::jsonb;
begin
  if p_audience not in ('all', 'accepted') then
    raise exception 'audience must be all or accepted' using errcode = 'check_violation';
  end if;
  if p_title is null or length(btrim(p_title)) = 0 or p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'a title and a message are both required' using errcode = 'check_violation';
  end if;

  select * into v_t from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'tournament not found' using errcode = 'no_data_found'; end if;
  if not (public.is_org_admin(v_t.org_id)
          or public.has_tournament_permission('manage_tournament_communications', p_tournament_id)) then
    raise exception 'you cannot post announcements for this tournament' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(nullif(btrim(name), ''), email) into v_name
    from public.users where id = auth.uid();

  insert into public.tournament_announcements
    (tournament_id, org_id, title, body, audience, created_by, author_name)
  values
    (p_tournament_id, v_t.org_id, btrim(p_title), btrim(p_body), p_audience, auth.uid(), v_name)
  returning id into v_id;

  for r in
    select distinct on (tec.user_id) tec.user_id, te.id as entry_id
      from public.tournament_entry_contacts tec
      join public.tournament_entries te on te.id = tec.entry_id
     where te.tournament_id = p_tournament_id
       and tec.account_status = 'active'
       and tec.user_id is not null
       and (te.status = 'accepted' or (p_audience = 'all' and te.status = 'pending'))
     order by tec.user_id, te.created_at
  loop
    insert into public.notifications
      (org_id, recipient_user_id, channel, template, payload, link_path)
    values
      (v_t.org_id, r.user_id, 'in_app', 'tournament.announcement',
       jsonb_build_object(
         'title', btrim(p_title),
         'body', left(btrim(p_body), 240),
         'tournament', v_t.name
       ),
       '/entry/' || r.entry_id)
    returning id into v_notif_id;

    v_recipients := v_recipients || jsonb_build_object(
      'recipient_user_id', r.user_id, 'notification_id', v_notif_id, 'link_path', '/entry/' || r.entry_id);
  end loop;

  perform public.write_audit_system(
    v_t.org_id,
    'tournament.announcement.posted',
    'tournament',
    p_tournament_id,
    'tournament_announcement',
    v_id::text,
    null,
    jsonb_build_object('title', btrim(p_title), 'audience', p_audience)
  );

  return jsonb_build_object('announcement_id', v_id, 'recipients', v_recipients);
end
$$;
revoke all on function public.post_tournament_announcement(uuid, text, text, text) from public, anon;
grant execute on function public.post_tournament_announcement(uuid, text, text, text) to authenticated, service_role;

-- review_entry_document() inserts into notifications directly instead of calling
-- create_notification() -- that function checks is_org_member() on the CALLER, and
-- tournament staff reviewing a team's document aren't org members (same trap class
-- as phase5c's RETURNING-triggers-a-read-check bug; see phase15d1's own fix for the
-- first time this exact mistake was made and caught). Returns jsonb so the caller
-- can dispatch push from the created notification's own id.
drop function if exists public.review_entry_document(uuid, text, text);
create function public.review_entry_document(
  p_document_id uuid,
  p_status text,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d public.tournament_entry_documents%rowtype;
  v_role_name text;
  v_notif_id uuid;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'status must be approved or rejected' using errcode = 'check_violation';
  end if;
  if p_status = 'rejected' and (p_note is null or length(btrim(p_note)) = 0) then
    raise exception 'say why it was rejected so the team knows what to fix' using errcode = 'check_violation';
  end if;

  select * into d from public.tournament_entry_documents where id = p_document_id;
  if not found then raise exception 'document not found' using errcode = 'no_data_found'; end if;
  if not (public.is_org_admin(d.org_id)
          or public.has_tournament_permission('manage_tournament_documents', d.tournament_id)) then
    raise exception 'you cannot review documents for this tournament' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(nullif(btrim(name), ''), email) into v_role_name
    from public.users where id = auth.uid();

  update public.tournament_entry_documents
     set status = p_status,
         review_note = nullif(btrim(p_note), ''),
         reviewed_by = auth.uid(),
         reviewed_by_role = v_role_name,
         reviewed_at = now()
   where id = p_document_id;

  perform public.write_audit_system(
    d.org_id,
    case when p_status = 'approved' then 'tournament.document.approved' else 'tournament.document.rejected' end,
    'tournament',
    d.tournament_id,
    'tournament_entry_document',
    p_document_id::text,
    null,
    jsonb_build_object('entry_id', d.entry_id, 'name', d.name)
  );

  if d.uploaded_by is not null and d.uploaded_by_role <> 'staff' then
    insert into public.notifications
      (org_id, recipient_user_id, channel, template, payload, link_path)
    values
      (d.org_id, d.uploaded_by, 'in_app', 'tournament.document.reviewed',
       jsonb_build_object(
         'title', case when p_status = 'approved' then 'Document approved' else 'Document needs attention' end,
         'body', d.name
       ),
       '/entry/' || d.entry_id)
    returning id into v_notif_id;

    return jsonb_build_object('recipient_user_id', d.uploaded_by, 'notification_id', v_notif_id, 'link_path', '/entry/' || d.entry_id);
  end if;

  return '{}'::jsonb;
end
$$;
revoke all on function public.review_entry_document(uuid, text, text) from public, anon;
grant execute on function public.review_entry_document(uuid, text, text) to authenticated, service_role;
