-- Provision a zero-priced trial subscription for validation. This creates
-- commercial state without charging or suspending access.

create or replace function public.ensure_default_billing_subscription(
  p_org_id uuid,
  p_product text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_plan_id uuid;
  v_plan_key text;
begin
  if not public.is_platform_admin() then raise exception 'platform admin only' using errcode = 'insufficient_privilege'; end if;
  if p_product not in ('club','tournament','combined') then raise exception 'invalid subscription product' using errcode = 'check_violation'; end if;

  v_plan_key := case when p_product = 'club' then 'club-basic' when p_product = 'tournament' then 'tournament-basic' else 'combined-basic' end;
  select id into v_plan_id from public.billing_plans where plan_key = v_plan_key and version = 1;
  if v_plan_id is null then raise exception 'default billing plan not found' using errcode = 'no_data_found'; end if;

  select id into v_id from public.billing_subscriptions
   where org_id = p_org_id and product = p_product and status in ('trial','active','past_due','grace_period','restricted')
   order by created_at desc limit 1;
  if v_id is not null then return v_id; end if;

  insert into public.billing_subscriptions(org_id, plan_id, product, status)
  values (p_org_id, v_plan_id, p_product, 'trial')
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.ensure_default_billing_subscription(uuid,text) from public, anon;
grant execute on function public.ensure_default_billing_subscription(uuid,text) to authenticated;
