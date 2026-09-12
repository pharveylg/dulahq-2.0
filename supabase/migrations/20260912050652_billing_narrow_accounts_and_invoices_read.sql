drop policy if exists billing_accounts_read on public.billing_accounts;
create policy billing_accounts_read on public.billing_accounts
  for select to authenticated
  using (public.can_read_billing_account(id));

drop policy if exists billing_invoices_read on public.billing_invoices;
create policy billing_invoices_read on public.billing_invoices
  for select to authenticated
  using (
    public.is_platform_admin()
    or payer_user_id = auth.uid()
    or (payer_org_id is not null and public.is_org_member(payer_org_id))
    or public.can_read_billing_account(billing_account_id)
  );
