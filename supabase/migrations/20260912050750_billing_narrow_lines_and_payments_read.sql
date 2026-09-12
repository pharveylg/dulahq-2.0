drop policy if exists billing_invoice_lines_read on public.billing_invoice_lines;
create policy billing_invoice_lines_read on public.billing_invoice_lines
  for select to authenticated
  using (exists (
    select 1 from public.billing_invoices i
    where i.id = invoice_id
      and (
        public.is_platform_admin()
        or i.payer_user_id = auth.uid()
        or (i.payer_org_id is not null and public.is_org_member(i.payer_org_id))
        or public.can_read_billing_account(i.billing_account_id)
      )
  ));

drop policy if exists billing_payment_submissions_read on public.billing_payment_submissions;
create policy billing_payment_submissions_read on public.billing_payment_submissions
  for select to authenticated
  using (
    public.is_platform_admin()
    or payer_user_id = auth.uid()
    or exists (
      select 1 from public.billing_invoices i
      where i.id = invoice_id and public.can_read_billing_account(i.billing_account_id)
    )
  );
