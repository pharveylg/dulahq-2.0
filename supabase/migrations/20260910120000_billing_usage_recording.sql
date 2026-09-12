-- Idempotent usage recording for Platform/Club/Tournament metering.
-- Usage events are append-only facts; invoice rating can snapshot them later.

create or replace function public.record_billing_usage_event(
  p_org_id uuid,
  p_meter_key text,
  p_context_type text,
  p_context_id uuid default null,
  p_quantity numeric default 0,
  p_source_type text default null,
  p_source_id text default null,
  p_occurred_at timestamptz default now(),
  p_idempotency_key text default null
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_id bigint;
  v_meter public.billing_usage_meters%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  if not public.is_platform_admin() and not public.is_org_member(p_org_id) then
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
end $$;

revoke all on function public.record_billing_usage_event(uuid,text,text,uuid,numeric,text,text,timestamptz,text) from public, anon;
grant execute on function public.record_billing_usage_event(uuid,text,text,uuid,numeric,text,text,timestamptz,text) to authenticated;
