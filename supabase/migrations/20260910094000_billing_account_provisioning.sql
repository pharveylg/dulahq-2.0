-- Provision the organization-level billing context alongside a tenant.

create or replace function public.ensure_platform_billing_account(p_org_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only' using errcode = 'insufficient_privilege';
  end if;

  select name into v_name from public.organizations where id = p_org_id;
  if v_name is null then raise exception 'organization not found' using errcode = 'no_data_found'; end if;

  insert into public.billing_accounts(org_id, context_type, display_name)
  values (p_org_id, 'platform', v_name || ' — Dula HQ subscription')
  on conflict (org_id) where context_type = 'platform'
  do update set display_name = excluded.display_name, updated_at = now()
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.ensure_platform_billing_account(uuid) from public, anon;
grant execute on function public.ensure_platform_billing_account(uuid) to authenticated;
