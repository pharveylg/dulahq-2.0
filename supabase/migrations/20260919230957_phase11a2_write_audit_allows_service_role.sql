-- The service-role key is the trusted server-side credential (seed scripts, the
-- RLS suite's fixtures); it has no auth.uid() so the relationship check can't
-- apply to it. It bypasses RLS everywhere else, so refusing it here would only
-- break tooling, not protect anything.
create or replace function public.write_audit(
  p_org_id      uuid,
  p_action      text,
  p_scope_type  text default null,
  p_scope_id    uuid default null,
  p_entity_type text default null,
  p_entity_id   text default null,
  p_before      jsonb default null,
  p_after       jsonb default null
) returns bigint
language plpgsql security definer set search_path = public as $$
begin
  if not (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_platform_admin()
    or (p_org_id is not null and public.is_user_in_org(auth.uid(), p_org_id))
  ) then
    raise exception 'not authorized to write audit entries for this organization'
      using errcode = 'insufficient_privilege';
  end if;
  return public.write_audit_system(p_org_id, p_action, p_scope_type, p_scope_id,
                                   p_entity_type, p_entity_id, p_before, p_after);
end $$;
