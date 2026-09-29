-- Two small additions for theming the entrant flow all the way back to the sign-in
-- screen (§0v/§0w follow-up): the portal now tells its own contact the host org's
-- accent and the tournament's own poster, and a new, deliberately anon-readable lookup
-- lets /login show a tournament's poster as a watermark before anyone has signed in.

create or replace function public.entrant_entry_portal(p_entry_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_entry record;
  v_role text;
  v_account record;
begin
  select te.id, te.team_name, te.status, te.host_org_id, te.tournament_id, t.name as tournament_name,
         t.poster_url as tournament_poster_url,
         o.name as host_org_name, o.accent as host_org_accent, tc.name as category_name
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
             'tournament_name', v_entry.tournament_name, 'tournament_poster_url', v_entry.tournament_poster_url,
             'host_org_name', v_entry.host_org_name,
             'host_org_accent', v_entry.host_org_accent, 'category_name', v_entry.category_name),
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

-- Deliberately callable by anon: this exists ONLY so the sign-in screen can show a
-- tournament's poster and accent as a background before anyone has authenticated. It
-- reveals the tournament's name, poster and accent for a given entry id -- nothing about
-- the entry itself (no team name, status or contacts) -- and only while the host org is
-- active. This is not a wider hole than what's already public: organizations' own
-- name/accent/logo are anon-readable with no listing gate at all (orgs_public_read).
create or replace function public.entry_login_background(p_entry_id uuid)
returns table (poster_url text, tournament_name text, accent text)
language sql stable security definer set search_path = public as $$
  select t.poster_url, t.name, o.accent
    from public.tournament_entries te
    join public.tournaments t on t.id = te.tournament_id
    join public.organizations o on o.id = t.org_id
   where te.id = p_entry_id
     and public.org_access_allowed(t.org_id);
$$;

revoke all on function public.entrant_entry_portal(uuid) from public, anon;
grant execute on function public.entrant_entry_portal(uuid) to authenticated, service_role;

revoke all on function public.entry_login_background(uuid) from public;
grant execute on function public.entry_login_background(uuid) to anon, authenticated, service_role;

-- anon_executable_secdef_count() (phase6s/6v) asserts zero as a tripwire against
-- accidentally reopening a SECURITY DEFINER function to anon. entry_login_background is
-- the first DELIBERATE exception, so the guard gets a named, single-purpose allowlist
-- rather than being weakened generally -- adding anything else to it later is exactly
-- the kind of change that should be conscious and reviewed, not free.
create or replace function public.anon_executable_secdef_allowlist()
returns text[]
language sql immutable as $$
  select array['entry_login_background'];
$$;

create or replace function public.anon_executable_secdef_count()
returns integer
language sql stable set search_path = public as $$
  select count(*)::int
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'execute')
    and not (p.proname = any (public.anon_executable_secdef_allowlist()));
$$;

revoke all on function public.anon_executable_secdef_allowlist() from public, anon, authenticated;
grant execute on function public.anon_executable_secdef_allowlist() to service_role;

-- CREATE OR REPLACE resets grants to the PUBLIC default (§0g) -- restate this
-- function's own original grants (not itself SECURITY DEFINER, but anon should still
-- not be able to read the count).
revoke all on function public.anon_executable_secdef_count() from public, anon;
grant execute on function public.anon_executable_secdef_count() to authenticated, service_role;
