-- Run manually in a Supabase SQL editor after the billing migrations.
-- This is intentionally read-only except for the transaction-scoped checks.

begin;

-- Schema objects
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'billing_accounts', 'billing_invoices', 'billing_invoice_lines',
    'billing_payment_submissions', 'billing_payment_allocations',
    'billing_usage_meters', 'billing_usage_events', 'billing_usage_periods'
  )
order by table_name;

-- Expected initial meters
select key, product, unit, active
from public.billing_usage_meters
order by key;

-- Every existing club/tournament should have a billing context after the
-- provisioning migration.
select 'clubs_without_billing_account' as check_name, count(*) as failures
from public.clubs c
where not exists (
  select 1 from public.billing_accounts b
  where b.context_type = 'club' and b.club_id = c.id
)
union all
select 'tournaments_without_billing_account', count(*)
from public.tournaments t
where not exists (
  select 1 from public.billing_accounts b
  where b.context_type = 'tournament' and b.tournament_id = t.id
);

-- Default validation plans and included meters
select p.plan_key, p.name, pm.meter_key, pm.included_quantity, pm.overage_unit_amount
from public.billing_plans p
left join public.billing_plan_meters pm on pm.plan_id = p.id
where p.status = 'active'
order by p.plan_key, pm.meter_key;

-- Security shape: all billing tables must have RLS enabled.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname like 'billing_%'
order by c.relname;

rollback;
