-- Two small companions the troubleshooting UI needs and that closed gap
-- analysis findings §1.2/§1.5 flag as missing:
--
-- 1. org_people_directory: platform_impersonation was built with no way to
--    enumerate WHO belongs to an org to view-as in the first place --
--    it_club_directory()/tournament_staff_directory() only ever look at one
--    club/tournament at a time. This is the org-wide version, spanning both
--    entitlements, platform-admin only (this is not a general directory --
--    it deliberately returns more than either entitlement-scoped directory
--    would, which is fine only because platform admin already sees
--    everything through other means).
--
-- 2. platform_audit_log: club_audit_log()/tournament_audit_log() exist;
--    platform admin had no equivalent read path at all, beyond the raw
--    table with the service-role key.
create or replace function public.org_people_directory(p_org_id uuid)
returns table (
  user_id uuid,
  name text,
  email text,
  source text,
  role text
)
language sql stable security definer set search_path = public as $$
  select u.id, u.name, u.email, 'club_staff', cs.role
  from public.club_staff cs
  join public.clubs c on c.id = cs.club_id
  join public.users u on u.id = cs.user_id
  where c.org_id = p_org_id and cs.status = 'active' and public.is_platform_admin()
  union all
  select u.id, u.name, u.email, 'tournament_staff', ts.role
  from public.tournament_staff ts
  join public.users u on u.id = ts.user_id
  where ts.org_id = p_org_id and ts.status = 'active' and public.is_platform_admin()
  union all
  select u.id, u.name, u.email, 'tournament_entry_contact', tec.role
  from public.tournament_entry_contacts tec
  join public.users u on u.id = tec.user_id
  where tec.org_id = p_org_id and tec.account_status = 'active' and public.is_platform_admin()
  union all
  select u.id, u.name, u.email, 'org_member', 'org_admin'
  from public.org_members om
  join public.users u on u.id = om.user_id
  where om.org_id = p_org_id and public.is_platform_admin()
  order by name;
$$;

revoke all on function public.org_people_directory(uuid) from public, anon;
grant execute on function public.org_people_directory(uuid) to authenticated;

create or replace function public.platform_audit_log(p_org_id uuid default null, p_limit int default 200)
returns table (
  id bigint,
  ts timestamptz,
  org_id uuid,
  org_name text,
  actor_email text,
  scope_type text,
  scope_id uuid,
  action text,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb
)
language sql stable security definer set search_path = public as $$
  select a.id, a.ts, a.org_id, o.name, a.actor_email, a.scope_type, a.scope_id,
         a.action, a.entity_type, a.entity_id, a.before, a.after
  from public.audit_log a
  left join public.organizations o on o.id = a.org_id
  where public.is_platform_admin()
    and (p_org_id is null or a.org_id = p_org_id)
  order by a.ts desc
  limit least(greatest(coalesce(p_limit, 200), 1), 1000);
$$;

revoke all on function public.platform_audit_log(uuid, int) from public, anon;
grant execute on function public.platform_audit_log(uuid, int) to authenticated;
