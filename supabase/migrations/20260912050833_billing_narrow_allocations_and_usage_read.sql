drop policy if exists billing_payment_allocations_read on public.billing_payment_allocations;
create policy billing_payment_allocations_read on public.billing_payment_allocations
  for select to authenticated
  using (exists (
    select 1 from public.billing_invoices i
    where i.id = invoice_id
      and (
        public.is_platform_admin()
        or i.payer_user_id = auth.uid()
        or public.can_read_billing_account(i.billing_account_id)
      )
  ));

drop policy if exists billing_usage_events_read on public.billing_usage_events;
create policy billing_usage_events_read on public.billing_usage_events
  for select to authenticated
  using (public.can_read_billing_context(context_type, context_id, org_id));

drop policy if exists billing_usage_periods_read on public.billing_usage_periods;
create policy billing_usage_periods_read on public.billing_usage_periods
  for select to authenticated
  using (public.is_platform_admin() or public.is_org_admin(org_id));
