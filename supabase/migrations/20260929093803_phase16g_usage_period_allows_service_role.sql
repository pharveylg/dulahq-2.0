-- Same bug, same fix, one function over from phase16f: snapshot_billing_usage_period()
-- also required auth.uid(), so run_monthly_usage_snapshot() couldn't call this one
-- either. Caught before it broke the manual test run a second time, not after.
create or replace function public.snapshot_billing_usage_period(p_org_id uuid, p_meter_key text, p_period_start date, p_period_end date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_quantity numeric(12,3);
begin
  if not (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_platform_admin()
    or public.is_org_member(p_org_id)
  ) then
    raise exception 'not authorized to snapshot usage for this organization' using errcode = 'insufficient_privilege';
  end if;
  if p_period_end < p_period_start then raise exception 'period end must not precede period start' using errcode = 'check_violation'; end if;

  select coalesce(sum(quantity), 0)::numeric(12,3) into v_quantity
    from public.billing_usage_events
   where org_id = p_org_id
     and meter_key = p_meter_key
     and occurred_at >= p_period_start::timestamptz
     and occurred_at < (p_period_end + 1)::timestamptz;

  insert into public.billing_usage_periods(org_id, meter_key, period_start, period_end, quantity, status)
  values (p_org_id, p_meter_key, p_period_start, p_period_end, v_quantity, 'projected')
  on conflict (org_id, meter_key, period_start, period_end)
  do update set quantity = excluded.quantity, status = case when billing_usage_periods.status = 'locked' then 'locked' else 'projected' end, updated_at = now()
  returning id into v_id;

  return v_id;
end $function$;
