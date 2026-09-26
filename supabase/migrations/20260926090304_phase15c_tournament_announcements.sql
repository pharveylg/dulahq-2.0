-- Tournament announcements: manage_tournament_communications (communications role and
-- organizer) had no consumer. A post reaches the entry contacts of that tournament: it is
-- listed on their portal page (phase15a) and lands in their notification bell.
--
-- Audience 'all' reaches pending and accepted entrants; 'accepted' only accepted ones.
-- Declined and withdrawn teams are never addressed. Staff read the table; entrants read
-- through entrant_entry_portal() only; every write goes through the functions below, so a
-- post cannot be edited after the fact (retracting hides it and is audited).

create table if not exists public.tournament_announcements (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  title         text not null check (length(btrim(title)) > 0),
  body          text not null check (length(btrim(body)) > 0),
  audience      text not null check (audience in ('all', 'accepted')),
  created_by    uuid references public.users(id) on delete set null,
  author_name   text,
  created_at    timestamptz not null default now(),
  retracted_at  timestamptz
);
create index if not exists tournament_announcements_t_idx on public.tournament_announcements (tournament_id, created_at desc);
alter table public.tournament_announcements enable row level security;
revoke all on public.tournament_announcements from anon;
revoke insert, update, delete, truncate on public.tournament_announcements from authenticated;

create policy tournament_announcements_read on public.tournament_announcements for select to authenticated
using (public.is_org_admin(org_id) or public.is_tournament_staff(tournament_id));

create policy org_not_suspended on public.tournament_announcements as restrictive for all to authenticated
using (public.org_access_allowed(org_id)) with check (public.org_access_allowed(org_id));

create or replace function public.post_tournament_announcement(p_tournament_id uuid, p_title text, p_body text, p_audience text default 'all')
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_t public.tournaments%rowtype; v_id uuid; v_name text; r record;
begin
  if p_audience not in ('all', 'accepted') then
    raise exception 'audience must be all or accepted' using errcode = 'check_violation';
  end if;
  if p_title is null or length(btrim(p_title)) = 0 or p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'a title and a message are both required' using errcode = 'check_violation';
  end if;
  select * into v_t from public.tournaments where id = p_tournament_id;
  if not found then raise exception 'tournament not found' using errcode = 'no_data_found'; end if;
  if not (public.is_org_admin(v_t.org_id) or public.has_tournament_permission('manage_tournament_communications', p_tournament_id)) then
    raise exception 'you cannot post announcements for this tournament' using errcode = 'insufficient_privilege';
  end if;
  select coalesce(nullif(btrim(name), ''), email) into v_name from public.users where id = auth.uid();
  insert into public.tournament_announcements (tournament_id, org_id, title, body, audience, created_by, author_name)
  values (p_tournament_id, v_t.org_id, btrim(p_title), btrim(p_body), p_audience, auth.uid(), v_name)
  returning id into v_id;

  -- One bell notification per person, even if they manage several entries here.
  for r in
    select distinct on (tec.user_id) tec.user_id, te.id as entry_id
      from public.tournament_entry_contacts tec
      join public.tournament_entries te on te.id = tec.entry_id
     where te.tournament_id = p_tournament_id
       and tec.account_status = 'active' and tec.user_id is not null
       and (te.status = 'accepted' or (p_audience = 'all' and te.status = 'pending'))
     order by tec.user_id, te.created_at
  loop
    insert into public.notifications (org_id, recipient_user_id, channel, template, payload, link_path)
    values (v_t.org_id, r.user_id, 'in_app', 'tournament.announcement',
            jsonb_build_object('title', btrim(p_title), 'body', left(btrim(p_body), 240), 'tournament', v_t.name),
            '/entry/' || r.entry_id);
  end loop;

  perform public.write_audit_system(v_t.org_id, 'tournament.announcement.posted', 'tournament', p_tournament_id,
    'tournament_announcement', v_id::text, null, jsonb_build_object('title', btrim(p_title), 'audience', p_audience));
  return v_id;
end $$;

create or replace function public.retract_tournament_announcement(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare a public.tournament_announcements%rowtype;
begin
  select * into a from public.tournament_announcements where id = p_id;
  if not found then raise exception 'announcement not found' using errcode = 'no_data_found'; end if;
  if not (public.is_org_admin(a.org_id) or public.has_tournament_permission('manage_tournament_communications', a.tournament_id)) then
    raise exception 'you cannot retract this' using errcode = 'insufficient_privilege';
  end if;
  update public.tournament_announcements set retracted_at = now() where id = p_id and retracted_at is null;
  if found then
    perform public.write_audit_system(a.org_id, 'tournament.announcement.retracted', 'tournament', a.tournament_id,
      'tournament_announcement', p_id::text, null, jsonb_build_object('title', a.title));
  end if;
end $$;

-- The portal (phase15a) gains the announcements addressed to this entry.
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

revoke all on function public.post_tournament_announcement(uuid, text, text, text) from public, anon;
revoke all on function public.retract_tournament_announcement(uuid) from public, anon;
revoke all on function public.entrant_entry_portal(uuid) from public, anon;
grant execute on function public.post_tournament_announcement(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.retract_tournament_announcement(uuid) to authenticated, service_role;
grant execute on function public.entrant_entry_portal(uuid) to authenticated, service_role;
