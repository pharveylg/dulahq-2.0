-- write_audit() had no authorization at all: any signed-in user could write an
-- audit row claiming any action in ANY org. The actor is always the real
-- caller (taken from the JWT, not a parameter), so it can't frame someone
-- else, but it lets anyone pollute another org's audit trail -- and audit
-- integrity is the entire point of an audit log.
--
-- It can't just start checking membership: 17 SECURITY DEFINER functions call
-- it internally, and some legitimately write into an org the caller doesn't
-- belong to (port_squad_to_tournament records the roster hand-off in the HOST
-- org as well as the entrant's). So: the unchecked body moves to
-- write_audit_system, reachable only from inside those functions (a definer
-- function runs as the owner, so it needs no EXECUTE grant for clients), and
-- the client-callable write_audit() gets the check (phase11a1).
create or replace function public.write_audit_system(
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
declare v_id bigint;
begin
  insert into public.audit_log (
    org_id, actor_user_id, actor_email, scope_type, scope_id,
    action, entity_type, entity_id, before, after)
  values (
    p_org_id, auth.uid(), auth.jwt() ->> 'email', p_scope_type, p_scope_id,
    p_action, p_entity_type, p_entity_id, p_before, p_after)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.write_audit_system(uuid, text, text, uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.write_audit_system(uuid, text, text, uuid, text, text, jsonb, jsonb) to service_role;

-- Repoint every internal caller. Mechanical on purpose: regenerate each
-- definition from the catalog and swap only the call, so nothing else about
-- any of these functions can drift.
do $$
declare
  r record;
  v_def text;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname <> 'write_audit'
      and p.proname <> 'write_audit_system'
      and p.prosrc ~ 'write_audit\('
  loop
    v_def := pg_get_functiondef(r.oid);
    v_def := regexp_replace(v_def, '(public\.)?write_audit\(', 'public.write_audit_system(', 'g');
    execute v_def;
  end loop;
end $$;
