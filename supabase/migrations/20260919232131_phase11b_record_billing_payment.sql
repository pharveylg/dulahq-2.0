-- A host who receives an entry fee in cash, or sees a transfer land in their own
-- bank account, has nothing to "verify": no payer ever submitted anything.
-- review_billing_payment only acts on an existing submission, so without this
-- the only way to mark such an invoice paid was Platform Admin editing rows.
-- Authorization is exactly review_billing_payment's (can_review_billing_invoice),
-- so this widens nobody: whoever can verify a payment can also record one.
--
-- Unlike review (which clamps to the balance), recording refuses an amount over
-- the remaining balance: a person typing a figure in has made a mistake worth
-- surfacing, not one to silently trim.
create or replace function public.record_billing_payment(
  p_invoice_id       uuid,
  p_amount           numeric,
  p_method           text default 'cash',
  p_reference_number text default null,
  p_note             text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_invoice   public.billing_invoices%rowtype;
  v_account   public.billing_accounts%rowtype;
  v_amount    numeric(12,2);
  v_remaining numeric(12,2);
  v_paid      numeric(12,2);
  v_id        uuid;
begin
  select * into v_invoice from public.billing_invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice not found' using errcode = 'no_data_found'; end if;
  if not public.can_review_billing_invoice(v_invoice.id) then
    raise exception 'not authorized to record payments on this invoice' using errcode = 'insufficient_privilege';
  end if;
  if v_invoice.status in ('draft','paid','refunded','cancelled','waived') then
    raise exception 'an invoice that is % cannot take a payment', v_invoice.status using errcode = 'check_violation';
  end if;
  if p_method not in ('qr_transfer','bank_transfer','cash','other') then
    raise exception 'unknown payment method' using errcode = 'check_violation';
  end if;
  v_amount := round(coalesce(p_amount, 0), 2);
  if v_amount <= 0 then raise exception 'payment amount must be greater than zero' using errcode = 'check_violation'; end if;
  v_remaining := v_invoice.total - v_invoice.amount_paid;
  if v_amount > v_remaining then
    raise exception 'payment of % is more than the % still owing', v_amount, v_remaining using errcode = 'check_violation';
  end if;

  insert into public.billing_payment_submissions (
    org_id, invoice_id, payer_user_id, amount, currency, method, reference_number,
    status, reviewed_by, reviewer_note, reviewed_at
  ) values (
    v_invoice.org_id, v_invoice.id, null, v_amount, v_invoice.currency, p_method,
    nullif(trim(p_reference_number), ''), 'verified', auth.uid(),
    coalesce(nullif(trim(p_note), ''), 'Recorded by staff'), now()
  ) returning id into v_id;

  insert into public.billing_payment_allocations (payment_submission_id, invoice_id, amount)
  values (v_id, v_invoice.id, v_amount);

  select coalesce(sum(a.amount), 0) into v_paid
    from public.billing_payment_allocations a where a.invoice_id = v_invoice.id;
  update public.billing_invoices
     set amount_paid = v_paid,
         status = case when v_paid >= total then 'paid' else 'partially_paid' end,
         updated_at = now()
   where id = v_invoice.id;

  select * into v_account from public.billing_accounts where id = v_invoice.billing_account_id;
  perform public.write_audit_system(
    v_invoice.org_id, 'billing.payment.recorded', v_invoice.context_type,
    coalesce(v_account.club_id, v_account.tournament_id), 'billing_invoice', v_invoice.id::text, null,
    jsonb_build_object('payment_submission_id', v_id, 'amount', v_amount, 'method', p_method,
                       'reference_number', nullif(trim(p_reference_number), ''))
  );
  return v_id;
end $$;

revoke all on function public.record_billing_payment(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.record_billing_payment(uuid, numeric, text, text, text) to authenticated, service_role;
