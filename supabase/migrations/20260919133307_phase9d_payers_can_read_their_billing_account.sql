-- Regression from billing_narrow_accounts_and_invoices_read: the guardian
-- page reads an invoice together with billing_accounts(payment_instructions),
-- but after narrowing, a payer could read their own invoice and NOT the
-- account holding the instructions/QR for paying it. A payer may read the
-- account row of any invoice they owe (and only those -- never other
-- families' invoices, which live on the invoice table).
create or replace function public.is_billing_account_payer(p_account_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.billing_invoices i
    where i.billing_account_id = p_account_id
      and (i.payer_user_id = auth.uid()
           or (i.payer_org_id is not null and public.is_org_member(i.payer_org_id)))
  );
$$;

revoke all on function public.is_billing_account_payer(uuid) from public, anon;
grant execute on function public.is_billing_account_payer(uuid) to authenticated, service_role;

drop policy if exists billing_accounts_read on public.billing_accounts;
create policy billing_accounts_read on public.billing_accounts
  for select to authenticated
  using (public.can_read_billing_account(id) or public.is_billing_account_payer(id));
