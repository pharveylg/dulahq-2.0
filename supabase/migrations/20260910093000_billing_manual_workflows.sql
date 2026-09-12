-- Manual billing workflows for the validation phase.
-- Payment providers are deliberately not involved. These SECURITY DEFINER
-- functions are the only write path for invoices and payment submissions.

create or replace function public.create_billing_invoice(
  p_org_id uuid,
  p_billing_account_id uuid,
  p_context_type text,
  p_payer_type text,
  p_payer_user_id uuid default null,
  p_payer_org_id uuid default null,
  p_payer_label text default null,
  p_source_type text default null,
  p_source_id text default null,
  p_currency text default 'PHP',
  p_due_at timestamptz default null,
  p_notes text default null,
  p_lines jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_invoice_number text;
  v_subtotal numeric(12,2);
  v_line jsonb;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  if not public.is_platform_admin() and not public.is_org_member(p_org_id) then
    raise exception 'not authorized to create an invoice for this organization'
      using errcode = 'insufficient_privilege';
  end if;

  if p_context_type = 'platform' and not public.is_platform_admin() then
    raise exception 'only a platform admin can create a platform invoice'
      using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'at least one invoice line is required' using errcode = 'check_violation';
  end if;

  v_invoice_number := 'DULA-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(gen_random_uuid()::text, 1, 8));

  insert into public.billing_invoices (
    org_id, billing_account_id, invoice_number, context_type,
    payer_type, payer_user_id, payer_org_id, payer_label,
    source_type, source_id, currency, due_at, notes,
    created_by
  ) values (
    p_org_id, p_billing_account_id, v_invoice_number, p_context_type,
    p_payer_type, p_payer_user_id, p_payer_org_id, p_payer_label,
    p_source_type, p_source_id, p_currency, p_due_at, p_notes,
    auth.uid()
  ) returning id into v_invoice_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into public.billing_invoice_lines (
      invoice_id, description, source_type, source_id,
      quantity, unit_amount, line_total
    ) values (
      v_invoice_id,
      coalesce(v_line->>'description', 'Charge'),
      v_line->>'source_type',
      v_line->>'source_id',
      greatest(coalesce((v_line->>'quantity')::numeric, 1), 0),
      greatest(coalesce((v_line->>'unit_amount')::numeric, 0), 0),
      greatest(coalesce((v_line->>'quantity')::numeric, 1), 0)
        * greatest(coalesce((v_line->>'unit_amount')::numeric, 0), 0)
    );
  end loop;

  select coalesce(sum(line_total), 0)::numeric(12,2)
    into v_subtotal
    from public.billing_invoice_lines
   where invoice_id = v_invoice_id;

  update public.billing_invoices
     set subtotal = v_subtotal,
         total = v_subtotal,
         status = 'issued',
         issued_at = now(),
         updated_at = now()
   where id = v_invoice_id;

  perform public.write_audit(
    p_org_id, 'billing.invoice.created', p_context_type,
    case when p_context_type = 'club' then (select club_id from public.billing_accounts where id = p_billing_account_id)
         when p_context_type = 'tournament' then (select tournament_id from public.billing_accounts where id = p_billing_account_id)
         else null end,
    'billing_invoice', v_invoice_id::text, null,
    jsonb_build_object('invoice_number', v_invoice_number, 'context_type', p_context_type, 'total', v_subtotal)
  );

  return v_invoice_id;
end $$;

create or replace function public.submit_billing_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text default 'qr_transfer',
  p_reference_number text default null,
  p_proof_storage_key text default null,
  p_payer_note text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_invoice public.billing_invoices%rowtype;
  v_id uuid;
begin
  select * into v_invoice from public.billing_invoices where id = p_invoice_id;
  if not found then raise exception 'invoice not found' using errcode = 'no_data_found'; end if;
  if p_amount <= 0 then raise exception 'payment amount must be greater than zero' using errcode = 'check_violation'; end if;
  if not (v_invoice.payer_user_id = auth.uid()
          or (v_invoice.payer_org_id is not null and public.is_org_member(v_invoice.payer_org_id))
          or public.is_org_member(v_invoice.org_id)) then
    raise exception 'not authorized to submit payment for this invoice'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.billing_payment_submissions (
    org_id, invoice_id, payer_user_id, amount, currency, method,
    reference_number, proof_storage_key, payer_note
  ) values (
    v_invoice.org_id, p_invoice_id, auth.uid(), p_amount, v_invoice.currency, p_method,
    nullif(trim(p_reference_number), ''), p_proof_storage_key, p_payer_note
  ) returning id into v_id;

  update public.billing_invoices
     set status = 'submitted_for_verification', updated_at = now()
   where id = p_invoice_id and status not in ('paid','refunded','cancelled');

  perform public.write_audit(
    v_invoice.org_id, 'billing.payment.submitted', v_invoice.context_type,
    null, 'billing_invoice', p_invoice_id::text, null,
    jsonb_build_object('payment_submission_id', v_id, 'amount', p_amount, 'method', p_method)
  );
  return v_id;
end $$;

create or replace function public.review_billing_payment(
  p_payment_id uuid,
  p_status text,
  p_reviewer_note text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_payment public.billing_payment_submissions%rowtype;
  v_invoice public.billing_invoices%rowtype;
  v_paid numeric(12,2);
  v_allocated numeric(12,2);
begin
  if p_status not in ('verified','rejected','cancelled') then
    raise exception 'invalid review status' using errcode = 'check_violation';
  end if;

  select * into v_payment from public.billing_payment_submissions where id = p_payment_id for update;
  if not found then raise exception 'payment submission not found' using errcode = 'no_data_found'; end if;
  select * into v_invoice from public.billing_invoices where id = v_payment.invoice_id for update;
  if not found then raise exception 'invoice not found' using errcode = 'no_data_found'; end if;

  if not public.is_platform_admin() and not public.is_org_member(v_invoice.org_id) then
    raise exception 'not authorized to review this payment'
      using errcode = 'insufficient_privilege';
  end if;
  if v_payment.status = 'verified' then
    raise exception 'verified payment cannot be reviewed again' using errcode = 'check_violation';
  end if;

  update public.billing_payment_submissions
     set status = p_status, reviewed_by = auth.uid(), reviewer_note = p_reviewer_note, reviewed_at = now()
   where id = p_payment_id;

  if p_status = 'verified' then
    v_allocated := least(v_payment.amount, greatest(v_invoice.total - v_invoice.amount_paid, 0));
    if v_allocated <= 0 then
      raise exception 'invoice has no remaining balance' using errcode = 'check_violation';
    end if;

    insert into public.billing_payment_allocations(payment_submission_id, invoice_id, amount)
    values (p_payment_id, v_payment.invoice_id, v_allocated);

    select coalesce(sum(a.amount), 0) into v_paid
      from public.billing_payment_allocations a
     where a.invoice_id = v_invoice.id;

    update public.billing_invoices
       set amount_paid = v_paid,
           status = case when v_paid >= total then 'paid' else 'partially_paid' end,
           updated_at = now()
     where id = v_invoice.id;
  end if;

  perform public.write_audit(
    v_invoice.org_id, 'billing.payment.' || p_status, v_invoice.context_type,
    null, 'billing_payment_submission', p_payment_id::text, null,
    jsonb_build_object('invoice_id', v_invoice.id, 'amount', v_payment.amount, 'reviewer_note', p_reviewer_note)
  );
end $$;

revoke all on function public.create_billing_invoice(uuid,uuid,text,text,uuid,uuid,text,text,text,text,timestamptz,text,jsonb) from public, anon;
revoke all on function public.submit_billing_payment(uuid,numeric,text,text,text,text) from public, anon;
revoke all on function public.review_billing_payment(uuid,text,text) from public, anon;
grant execute on function public.create_billing_invoice(uuid,uuid,text,text,uuid,uuid,text,text,text,text,timestamptz,text,jsonb) to authenticated;
grant execute on function public.submit_billing_payment(uuid,numeric,text,text,text,text) to authenticated;
grant execute on function public.review_billing_payment(uuid,text,text) to authenticated;
