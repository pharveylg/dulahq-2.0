-- club_staff_read requires can_read_club (club_manager / org_admin), so the
-- IT role -- which deliberately has neither -- cannot list the people it is
-- meant to troubleshoot. Club Admin spec §11 permits exactly the account
-- layer for this purpose: "Name, Email, Account status, Authentication
-- status, Invitation status" and explicitly NOT development, financial,
-- medical or sensitive player data. This returns that and nothing more.
create or replace function public.it_club_directory(p_club_id uuid)
returns table (
  user_id uuid,
  name text,
  email text,
  role text,
  is_platform_admin boolean
)
language sql stable security definer set search_path = public as $$
  select
    cs.user_id,
    u.name,
    u.email,
    cs.role,
    (exists (
       select 1 from public.role_assignments ra
       where ra.user_id = cs.user_id and ra.scope_type = 'platform' and ra.role = 'platform_admin')
     or exists (
       select 1 from public.platform_admins pa
       join auth.users au on lower(au.email) = lower(pa.email)
       where au.id = cs.user_id)) as is_platform_admin
  from public.club_staff cs
  join public.users u on u.id = cs.user_id
  where cs.club_id = p_club_id
    and (
      public.has_staff_permission('impersonate_user', p_club_id)
      or public.has_staff_permission('view_audit_log', p_club_id)
    )
  order by u.name;
$$;

revoke all on function public.it_club_directory(uuid) from public, anon;
grant execute on function public.it_club_directory(uuid) to authenticated;
