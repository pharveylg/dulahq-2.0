-- record_billing_usage_event() required auth.uid(), so run_monthly_usage_snapshot()
-- (phase16e, service_role-only, no JWT/auth.uid() in a cron context) could never
-- actually call it -- caught live on the very first manual run: "not signed in".
-- Same shape, same fix as write_audit's own phase11a2: add the service_role
-- allowance write_audit already uses, rather than inventing a parallel
-- "_system" variant for a function this simple.
create or replace function public.record_billing_usage_event(p_org_id uuid, p_meter_key text, p_context_type text, p_context_id uuid DEFAULT NULL::uuid, p_quantity numeric DEFAULT 0, p_source_type text DEFAULT NULL::text, p_source_id text DEFAULT NULL::text, p_occurred_at timestamp with time zone DEFAULT now(), p_idempotency_key text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id bigint;
  v_meter public.billing_usage_meters%rowtype;
begin
  if not (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_platform_admin()
    or public.is_org_member(p_org_id)
  ) then
    raise exception 'not authorized to record usage for this organization' using errcode = 'insufficient_privilege';
  end if;
  select * into v_meter from public.billing_usage_meters where key = p_meter_key and active;
  if not found then raise exception 'active usage meter not found' using errcode = 'no_data_found'; end if;
  if p_quantity < 0 then raise exception 'usage quantity cannot be negative' using errcode = 'check_violation'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency key is required' using errcode = 'check_violation';
  end if;

  insert into public.billing_usage_events(
    org_id, meter_key, context_type, context_id, quantity,
    source_type, source_id, occurred_at, idempotency_key
  ) values (
    p_org_id, p_meter_key, p_context_type, p_context_id, p_quantity,
    p_source_type, p_source_id, p_occurred_at, trim(p_idempotency_key)
  ) on conflict (idempotency_key) do nothing returning id into v_id;

  if v_id is null then
    select id into v_id from public.billing_usage_events where idempotency_key = trim(p_idempotency_key);
  end if;
  return v_id;
end $function$;
