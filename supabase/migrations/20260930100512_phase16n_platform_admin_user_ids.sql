-- Phase 16n: platform_admin_user_ids() -- unions both sources of platform-admin
-- identity (role_assignments and the legacy platform_admins-by-email table) into
-- one list of user ids.
--
-- Reconstructed from the live project's current function definition; not
-- committed at the time it was applied (same gap as phase16m -- see that file's
-- own header note and CLAUDE.md §0a). Verified byte-for-byte against
-- pg_get_functiondef() on 2026-10-02, immediately before phase16o made this
-- function service-role-only.
--
-- Built because querying role_assignments alone (scope_type='platform',
-- role='platform_admin') returned zero rows in the live database -- both real
-- platform admins are recorded only in the legacy platform_admins table by
-- email, which is_platform_admin() already checks but no prior helper exposed
-- as a list of ids for a server action to notify.
create or replace function public.platform_admin_user_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct user_id from (
    select ra.user_id from public.role_assignments ra
     where ra.scope_type = 'platform' and ra.role = 'platform_admin'
    union
    select u.id as user_id from public.platform_admins pa
     join public.users u on lower(u.email) = lower(pa.email)
  ) ids;
$$;

revoke all on function public.platform_admin_user_ids() from public, anon;
grant execute on function public.platform_admin_user_ids() to authenticated, service_role;
