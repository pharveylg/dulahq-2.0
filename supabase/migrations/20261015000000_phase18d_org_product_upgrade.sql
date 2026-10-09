-- Phase 3 of docs/proposals/self-serve-org-onboarding.md: upgrade via the EXISTING
-- manual billing path. No new payment infrastructure -- platform_billing_accounts,
-- billing_invoices, billing_payment_submissions and review_billing_payment already
-- exist (§0q/§0m) and already let only a platform admin verify a platform-context
-- payment (can_review_billing_invoice has no org-admin branch for 'platform' at all,
-- confirmed live before writing this). Two things were genuinely missing:
-- an org admin has no way to request their OWN invoice (ensure_platform_billing_account
-- and create_billing_invoice('platform', ...) are both is_platform_admin()-only), and
-- nothing ever flips an entitlement to 'active' once an invoice is actually paid.

create or replace function public.request_org_product_upgrade(p_org_id uuid, p_product text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_account_id uuid;
  v_plan record;
  v_existing record;
  v_invoice_id uuid;
  v_invoice_number text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.is_org_admin(p_org_id) then
    raise exception 'Only this organization''s admin can request an upgrade' using errcode = '42501';
  end if;
  if p_product not in ('club', 'tournament') then
    raise exception 'Invalid product: %', p_product using errcode = '22023';
  end if;
  if public.org_has_product(p_org_id, p_product)
     and (select status from public.org_entitlements where org_id = p_org_id and product = p_product) = 'active' then
    raise exception 'Already paid for % -- nothing to upgrade', p_product using errcode = '22023';
  end if;

  -- An open invoice for this org/product already exists -- hand that back rather
  -- than issuing a duplicate every time the button is clicked.
  select * into v_existing from public.billing_invoices
  where org_id = p_org_id and source_type = 'org_product_upgrade' and source_id = p_product
    and status in ('draft', 'issued', 'awaiting_payment', 'submitted_for_verification', 'partially_paid', 'overdue')
  order by created_at desc limit 1;
  if found then
    return jsonb_build_object('invoiceId', v_existing.id, 'status', v_existing.status, 'total', v_existing.total);
  end if;

  insert into public.billing_accounts (org_id, context_type, display_name)
  select p_org_id, 'platform', o.name || ' — Dula HQ subscription'
  from public.organizations o where o.id = p_org_id
  on conflict (org_id) where context_type = 'platform' do nothing;
  select id into v_account_id from public.billing_accounts where org_id = p_org_id and context_type = 'platform';

  select id, currency, base_amount into v_plan from public.billing_plans
  where plan_key = case p_product when 'club' then 'club-basic' else 'tournament-basic' end and version = 1;
  if v_plan.id is null then
    raise exception 'No published plan for %', p_product using errcode = '22023';
  end if;

  v_invoice_number := 'DULA-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(gen_random_uuid()::text, 1, 8));
  insert into public.billing_invoices (
    org_id, billing_account_id, invoice_number, context_type, payer_type, payer_org_id,
    source_type, source_id, currency, subtotal, total, status, issued_at,
    due_at, created_by
  ) values (
    p_org_id, v_account_id, v_invoice_number, 'platform', 'organization', p_org_id,
    'org_product_upgrade', p_product, v_plan.currency, v_plan.base_amount, v_plan.base_amount,
    case when v_plan.base_amount = 0 then 'paid' else 'awaiting_payment' end, now(),
    case when v_plan.base_amount = 0 then null else now() + interval '7 days' end, auth.uid()
  ) returning id into v_invoice_id;

  insert into public.billing_invoice_lines (invoice_id, description, source_type, source_id, quantity, unit_amount, line_total)
  values (v_invoice_id, initcap(p_product) || ' — Dula HQ subscription', 'org_product_upgrade', p_product, 1, v_plan.base_amount, v_plan.base_amount);

  perform public.write_audit_system(p_org_id, 'org.upgrade.requested', null, null,
    'billing_invoice', v_invoice_id::text, null, jsonb_build_object('product', p_product, 'total', v_plan.base_amount));

  return jsonb_build_object('invoiceId', v_invoice_id, 'status', case when v_plan.base_amount = 0 then 'paid' else 'awaiting_payment' end, 'total', v_plan.base_amount);
end $$;
revoke all on function public.request_org_product_upgrade(uuid, text) from public, anon;
grant execute on function public.request_org_product_upgrade(uuid, text) to authenticated, service_role;

-- Reacts to the invoice reaching 'paid', however that happened -- a free ($0) plan
-- marks itself paid immediately above, or Platform Admin verifies a real payment
-- through the EXISTING review_billing_payment/record_billing_payment path, which
-- this trigger needed no changes to. Referencing OLD is safe for the INSERT case:
-- `tg_op = 'INSERT' or ...` short-circuits before OLD is ever evaluated.
create or replace function public.activate_org_product_on_invoice_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_plan_id uuid;
begin
  if new.source_type = 'org_product_upgrade' and new.status = 'paid'
     and (tg_op = 'INSERT' or old.status is distinct from 'paid') then

    insert into public.org_entitlements (org_id, product, status, valid_until)
    values (new.org_id, new.source_id, 'active', null)
    on conflict (org_id, product) do update set status = 'active', valid_until = null, updated_at = now();

    select id into v_plan_id from public.billing_plans
      where plan_key = case new.source_id when 'club' then 'club-basic' else 'tournament-basic' end and version = 1;

    if exists (select 1 from public.billing_subscriptions where org_id = new.org_id and product = new.source_id) then
      update public.billing_subscriptions set status = 'active', ends_at = null, updated_at = now()
        where org_id = new.org_id and product = new.source_id;
    else
      insert into public.billing_subscriptions (org_id, plan_id, product, status, starts_at)
      values (new.org_id, v_plan_id, new.source_id, 'active', now());
    end if;

    delete from public.org_onboarding_shells where org_id = new.org_id;

    perform public.write_audit_system(new.org_id, 'org.product.activated', null, null,
      'org_entitlement', new.source_id, null, jsonb_build_object('product', new.source_id, 'invoice_id', new.id));
  end if;
  return new;
end $$;
revoke all on function public.activate_org_product_on_invoice_paid() from public, anon;
grant execute on function public.activate_org_product_on_invoice_paid() to authenticated, service_role;

drop trigger if exists activate_org_product on public.billing_invoices;
create trigger activate_org_product after insert or update on public.billing_invoices
  for each row execute function public.activate_org_product_on_invoice_paid();
