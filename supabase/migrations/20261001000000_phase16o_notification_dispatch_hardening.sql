-- Phase 16o: close the authenticated notification/push write and secret-read paths.
-- Push delivery now runs only in server code, receives a notification ID, and resolves
-- the recipient, payload, and link from that persisted row. Apply only after deploying
-- the matching server code; this file is source-only in this patch and is not applied.

-- Notifications are written only by trusted SECURITY DEFINER domain RPCs or by the
-- server-only service-role path. Authenticated users may still read their own rows and
-- mark them read, but cannot create arbitrary rows directly.
revoke insert, update on table public.notifications from public, anon, authenticated;
-- The inbox may only set the read marker; recipient/content/scope/delivery fields
-- remain immutable to signed-in clients.
grant update (read_at) on table public.notifications to authenticated;
drop policy if exists notifications_staff_create on public.notifications;

grant select, insert, update, delete on table public.notifications to service_role;
grant select, delete on table public.push_subscriptions to service_role;

-- These functions either accept caller-chosen notification targets/content, return
-- browser push secrets, or mutate another user's delivery metadata/subscription. The
-- app no longer calls them with an authenticated session.
revoke all on function public.create_notification(uuid, uuid, uuid, text, text, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.push_subscription_targets(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.mark_notification_sent(uuid, text)
  from public, anon, authenticated;
revoke all on function public.delete_stale_push_subscription(text)
  from public, anon, authenticated;

-- This is an internal recipient resolver, not a client-facing directory. Keep it
-- callable to trusted server code only.
revoke all on function public.staff_holding_permission(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.staff_holding_permission(uuid, text, uuid) to service_role;

-- Some deployments already have this helper from Phase 16n. Create a safe equivalent
-- on checkouts where it is not yet present, then consistently make it service-role-only.
do $$
begin
  if to_regprocedure('public.platform_admin_user_ids()') is null then
    execute $ddl$
      create function public.platform_admin_user_ids()
      returns uuid[]
      language sql
      stable
      security definer
      set search_path = public
      as $fn$
        select coalesce(array_agg(distinct u.id order by u.id), array[]::uuid[])
          from auth.users u
         where exists (
                 select 1 from public.role_assignments ra
                  where ra.user_id = u.id
                    and ra.scope_type = 'platform'
                    and ra.role = 'platform_admin'
               )
            or exists (
                 select 1 from public.platform_admins pa
                  where lower(pa.email) = lower(u.email)
               );
      $fn$
    $ddl$;
  end if;
end
$$;
revoke all on function public.platform_admin_user_ids() from public, anon, authenticated;
grant execute on function public.platform_admin_user_ids() to service_role;

-- Return the exact notification row IDs created for an announcement. The server action
-- passes only those IDs to sendPushForNotification(); it never supplies a recipient or
-- push payload to the delivery function. Zero eligible entrants is a successful post
-- with an empty ID list.
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
  v_notification_id uuid;
  v_notification_ids uuid[] := array[]::uuid[];
  r record;
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

  -- One bell notification per person, even if they manage several entries here.
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
    returning id into v_notification_id;

    v_notification_ids := array_append(v_notification_ids, v_notification_id);
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

  return jsonb_build_object(
    'announcement_id', v_id,
    'notification_ids', to_jsonb(v_notification_ids),
    'recipient_count', cardinality(v_notification_ids)
  );
end
$$;
revoke all on function public.post_tournament_announcement(uuid, text, text, text) from public, anon;
grant execute on function public.post_tournament_announcement(uuid, text, text, text) to authenticated, service_role;

-- The document-review RPC likewise returns only the ID of the notification it itself
-- created, allowing the caller to dispatch push without ever choosing a recipient.
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
  v_notification_id uuid;
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
    returning id into v_notification_id;
  end if;

  return jsonb_build_object(
    'document_id', p_document_id,
    'notification_id', v_notification_id
  );
end
$$;
revoke all on function public.review_entry_document(uuid, text, text) from public, anon;
grant execute on function public.review_entry_document(uuid, text, text) to authenticated, service_role;
