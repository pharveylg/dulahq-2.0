-- Entrant portal: a team contact from outside any organization can see their entry, its
-- invoice and the payment instructions, and submit a payment. Until now they could claim
-- an account (phase8d) but nothing rendered anything for them, and the tables' own
-- policies (rightly) hide entries and invoices from anyone who is not org or tournament
-- staff. Rather than widen those policies, the portal goes through definer functions that
-- authorize on is_tournament_entry_contact() first.
--
-- Only an ACTIVE contact has a portal: 'pending' contacts have not been accepted yet and
-- 'invited' ones have not signed in. The team_manager contact pays; a coach contact can see
-- the entry and invoice but not submit payment.

create or replace function public.my_entrant_entries()
returns table (entry_id uuid, team_name text, status text, tournament_name text, tournament_slug text,
               host_org_name text, category_name text, contact_role text)
language sql stable security definer set search_path = public as $$
  select te.id, te.team_name, te.status, t.name, t.slug, o.name, tc.name, tec.role
    from public.tournament_entry_contacts tec
    join public.tournament_entries te on te.id = tec.entry_id
    join public.tournaments t on t.id = te.tournament_id
    join public.organizations o on o.id = te.host_org_id
    left join public.tournament_categories tc on tc.id = te.category_id
   where tec.user_id = auth.uid()
     and tec.account_status = 'active'
     and public.org_access_allowed(te.host_org_id)
   order by t.name, te.team_name;
$$;

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

create or replace function public.submit_entry_payment(
  p_invoice_id uuid, p_amount numeric, p_method text default 'qr_transfer',
  p_reference text default null, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_inv public.billing_invoices%rowtype;
  v_entry uuid;
  v_pending numeric;
  v_id uuid;
begin
  select * into v_inv from public.billing_invoices where id = p_invoice_id;
  if not found or v_inv.source_type is distinct from 'tournament_entry' then
    raise exception 'invoice not found' using errcode = 'no_data_found';
  end if;
  v_entry := v_inv.source_id::uuid;
  -- Only the entry's team manager pays; coaches can see the entry but not send money.
  if not public.is_tournament_entry_contact(v_entry, 'team_manager') then
    raise exception 'only the team manager for this entry can submit a payment' using errcode = 'insufficient_privilege';
  end if;
  if not public.org_access_allowed(v_inv.org_id) then
    raise exception 'this tournament is not accepting payments right now' using errcode = 'insufficient_privilege';
  end if;
  if v_inv.status in ('draft', 'paid', 'refunded', 'cancelled', 'waived') then
    raise exception 'this invoice cannot take a payment' using errcode = 'check_violation';
  end if;
  if p_method not in ('qr_transfer', 'bank_transfer', 'cash', 'other') then
    raise exception 'unknown payment method' using errcode = 'check_violation';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'payment amount must be greater than zero' using errcode = 'check_violation';
  end if;
  select coalesce(sum(amount), 0) into v_pending from public.billing_payment_submissions
   where invoice_id = p_invoice_id and status in ('submitted', 'under_review');
  if p_amount > v_inv.total - v_inv.amount_paid - v_pending then
    raise exception 'that is more than is still owed on this invoice' using errcode = 'check_violation';
  end if;

  insert into public.billing_payment_submissions (org_id, invoice_id, payer_user_id, amount, currency, method, reference_number, payer_note)
  values (v_inv.org_id, p_invoice_id, auth.uid(), p_amount, v_inv.currency, p_method, nullif(trim(p_reference), ''), nullif(trim(p_note), ''))
  returning id into v_id;

  update public.billing_invoices set status = 'submitted_for_verification', updated_at = now() where id = p_invoice_id;

  perform public.write_audit_system(v_inv.org_id, 'billing.payment.submitted', v_inv.context_type, null,
    'billing_invoice', p_invoice_id::text, null,
    jsonb_build_object('payment_submission_id', v_id, 'amount', p_amount, 'method', p_method, 'by', 'entry_contact'));
  return v_id;
end $$;

revoke all on function public.my_entrant_entries() from public, anon;
revoke all on function public.entrant_entry_portal(uuid) from public, anon;
revoke all on function public.submit_entry_payment(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.my_entrant_entries() to authenticated, service_role;
grant execute on function public.entrant_entry_portal(uuid) to authenticated, service_role;
grant execute on function public.submit_entry_payment(uuid, numeric, text, text, text) to authenticated, service_role;
