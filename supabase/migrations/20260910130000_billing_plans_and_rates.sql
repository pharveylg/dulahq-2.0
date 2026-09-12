-- Versioned commercial catalog for simulation/manual billing. Amounts may be
-- zero while validating; changing a price means inserting a new version.

create table if not exists public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null,
  version integer not null default 1,
  name text not null,
  product text not null check (product in ('club','tournament','combined')),
  currency text not null default 'PHP' check (currency ~ '^[A-Z]{3}$'),
  base_amount numeric(12,2) not null default 0 check (base_amount >= 0),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly','annual','one_time')),
  status text not null default 'draft' check (status in ('draft','active','retired')),
  effective_from date not null default current_date,
  effective_until date,
  created_at timestamptz not null default now(),
  unique(plan_key, version),
  check (effective_until is null or effective_until >= effective_from)
);

create table if not exists public.billing_plan_meters (
  plan_id uuid not null references public.billing_plans(id) on delete cascade,
  meter_key text not null references public.billing_usage_meters(key) on delete restrict,
  included_quantity numeric(12,3) not null default 0 check (included_quantity >= 0),
  overage_unit_amount numeric(12,4) not null default 0 check (overage_unit_amount >= 0),
  primary key (plan_id, meter_key)
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.billing_plans(id) on delete restrict,
  product text not null check (product in ('club','tournament','combined')),
  status text not null default 'trial' check (status in ('trial','active','past_due','grace_period','restricted','suspended','cancelled','expired')),
  starts_at timestamptz not null default now(),
  renews_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_subscriptions_one_current_idx
  on public.billing_subscriptions(org_id, product) where status in ('trial','active','past_due','grace_period','restricted');
create index if not exists billing_subscriptions_org_idx on public.billing_subscriptions(org_id, status);

insert into public.billing_plans(plan_key, version, name, product, base_amount, status)
values
  ('club-basic', 1, 'Club Basic', 'club', 0, 'active'),
  ('tournament-basic', 1, 'Tournament Basic', 'tournament', 0, 'active'),
  ('combined-basic', 1, 'Combined Basic', 'combined', 0, 'active')
on conflict (plan_key, version) do nothing;

alter table public.billing_plans enable row level security;
alter table public.billing_plan_meters enable row level security;
alter table public.billing_subscriptions enable row level security;

create policy billing_plans_read on public.billing_plans for select to authenticated using (public.is_platform_admin() or status = 'active');
create policy billing_plan_meters_read on public.billing_plan_meters for select to authenticated using (exists (select 1 from public.billing_plans p where p.id = plan_id and (public.is_platform_admin() or p.status = 'active')));
create policy billing_subscriptions_read on public.billing_subscriptions for select to authenticated using (public.is_platform_admin() or public.is_org_member(org_id));

revoke all on public.billing_plans from anon, authenticated;
revoke all on public.billing_plan_meters from anon, authenticated;
revoke all on public.billing_subscriptions from anon, authenticated;
grant select on public.billing_plans to authenticated;
grant select on public.billing_plan_meters to authenticated;
grant select on public.billing_subscriptions to authenticated;

create or replace function public.project_billing_amount(
  p_org_id uuid,
  p_plan_id uuid,
  p_period_start date,
  p_period_end date
) returns table(
  meter_key text,
  quantity numeric,
  included_quantity numeric,
  overage_quantity numeric,
  overage_unit_amount numeric,
  projected_amount numeric
)
language sql security definer set search_path = public
as $$
  select pm.meter_key,
         coalesce(up.quantity, 0)::numeric,
         pm.included_quantity,
         greatest(coalesce(up.quantity, 0) - pm.included_quantity, 0)::numeric,
         pm.overage_unit_amount,
         (greatest(coalesce(up.quantity, 0) - pm.included_quantity, 0) * pm.overage_unit_amount)::numeric
    from public.billing_plan_meters pm
    left join public.billing_usage_periods up
      on up.org_id = p_org_id
     and up.meter_key = pm.meter_key
     and up.period_start = p_period_start
     and up.period_end = p_period_end
   where pm.plan_id = p_plan_id
   order by pm.meter_key;
$$;

revoke all on function public.project_billing_amount(uuid,uuid,date,date) from public, anon;
grant execute on function public.project_billing_amount(uuid,uuid,date,date) to authenticated;
