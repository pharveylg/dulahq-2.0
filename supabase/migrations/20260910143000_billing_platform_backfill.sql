-- Backfill platform billing contexts and validation subscriptions for
-- organizations that existed before the billing migrations were applied.

insert into public.billing_accounts(org_id, context_type, display_name)
select o.id, 'platform', o.name || ' — Dula HQ subscription'
from public.organizations o
where not exists (
  select 1 from public.billing_accounts b
  where b.context_type = 'platform' and b.org_id = o.id
);

insert into public.billing_subscriptions(org_id, plan_id, product, status)
select oe.org_id,
       bp.id,
       oe.product,
       'trial'
from public.org_entitlements oe
join public.billing_plans bp
  on bp.plan_key = case when oe.product = 'club' then 'club-basic' else 'tournament-basic' end
 and bp.version = 1
where oe.status in ('active','trial')
  and not exists (
    select 1 from public.billing_subscriptions bs
    where bs.org_id = oe.org_id
      and bs.product = oe.product
      and bs.status in ('trial','active','past_due','grace_period','restricted')
  );
