-- Narrow payment verification authority before billing workflows are enabled.
-- Platform Admin can review every context. Club reviewers need the existing
-- Club finance permission. Tournament review remains organizer-admin-only
-- until Tournament Manager adopts the shared tournament permission catalog.

create or replace function public.can_review_billing_invoice(p_invoice_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_invoice public.billing_invoices%rowtype;
  v_account public.billing_accounts%rowtype;
begin
  select * into v_invoice from public.billing_invoices where id = p_invoice_id;
  if not found then return false; end if;
  if public.is_platform_admin() then return true; end if;
  select * into v_account from public.billing_accounts where id = v_invoice.billing_account_id;
  if v_invoice.context_type = 'club' and v_account.club_id is not null then
    return public.has_staff_permission('manage_finances', v_account.club_id, null);
  end if;
  if v_invoice.context_type = 'tournament' then
    return public.is_org_admin(v_invoice.org_id);
  end if;
  return false;
end $$;

revoke all on function public.can_review_billing_invoice(uuid) from public, anon, authenticated;
grant execute on function public.can_review_billing_invoice(uuid) to authenticated;

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
  if not public.can_review_billing_invoice(v_invoice.id) then
    raise exception 'not authorized to review this payment' using errcode = 'insufficient_privilege';
  end if;
  if v_payment.status = 'verified' then
    raise exception 'verified payment cannot be reviewed again' using errcode = 'check_violation';
  end if;

  update public.billing_payment_submissions
     set status = p_status, reviewed_by = auth.uid(), reviewer_note = p_reviewer_note, reviewed_at = now()
   where id = p_payment_id;

  if p_status = 'verified' then
    v_allocated := least(v_payment.amount, greatest(v_invoice.total - v_invoice.amount_paid, 0));
    if v_allocated <= 0 then raise exception 'invoice has no remaining balance' using errcode = 'check_violation'; end if;
    insert into public.billing_payment_allocations(payment_submission_id, invoice_id, amount)
    values (p_payment_id, v_payment.invoice_id, v_allocated);
    select coalesce(sum(a.amount), 0) into v_paid
      from public.billing_payment_allocations a where a.invoice_id = v_invoice.id;
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

revoke all on function public.review_billing_payment(uuid,text,text) from public, anon;
grant execute on function public.review_billing_payment(uuid,text,text) to authenticated;
