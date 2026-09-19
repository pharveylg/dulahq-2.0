-- The client-callable write_audit(): the caller must have a real relationship
-- to the org they are writing about (any of the ones is_user_in_org knows:
-- org member, club staff, tournament staff, guardian, player, entry contact),
-- or be Platform Admin. Null org (system-wide rows) is Platform Admin only.
-- Server actions call this directly after acting in an org, so the caller
-- always has such a relationship; forging a row into an org you have no part
-- in is what stops working. Internal writes use write_audit_system.
-- (Superseded in the same session by phase11a2, which also admits the
-- service role; kept as applied.)
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
    public.is_platform_admin()
    or (p_org_id is not null and public.is_user_in_org(auth.uid(), p_org_id))
  ) then
    raise exception 'not authorized to write audit entries for this organization'
      using errcode = 'insufficient_privilege';
  end if;
  return public.write_audit_system(p_org_id, p_action, p_scope_type, p_scope_id,
                                   p_entity_type, p_entity_id, p_before, p_after);
end $$;
