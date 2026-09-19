-- Gap analysis 2026-09-11, Platform 1.1: organizations.status was written by
-- the console's Suspend button and read by NOTHING -- a suspended org's staff,
-- guardians and players kept every permission. These are the building blocks
-- that make it real. Platform Admin always bypasses (it must be able to see
-- and reactivate a suspended org).

create or replace function public.org_is_active(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select org is null
      or not exists (select 1 from public.organizations o where o.id = org and o.status = 'suspended');
$$;

create or replace function public.org_access_allowed(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.org_is_active(org) or public.is_platform_admin();
$$;

create or replace function public.club_org_is_active(club uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.org_is_active(c.org_id) from public.clubs c where c.id = club), true);
$$;

create or replace function public.tournament_org_is_active(tournament uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.org_is_active(t.org_id) from public.tournaments t where t.id = tournament), true);
$$;

-- Tables deliberately NOT fenced by the restrictive policy below. Billing
-- stays reachable so a suspended org can still see and settle an invoice
-- (suspension is often for non-payment); support stays reachable so it can
-- still contact Platform Admin. New org_id tables are fenced by default -- the
-- RLS suite fails until a new one is either fenced or listed here.
create or replace function public.org_fence_exempt(tbl text)
returns boolean
language sql immutable set search_path = public as $$
  select tbl like 'billing\_%' or tbl = 'support_requests';
$$;

-- Lets the app tell a suspended org's members WHY everything went empty.
create or replace function public.my_suspended_orgs()
returns table (org_id uuid, org_name text)
language sql stable security definer set search_path = public as $$
  select o.id, o.name
  from public.organizations o
  where o.status = 'suspended'
    and public.is_user_in_org(auth.uid(), o.id)
    and not public.is_platform_admin();
$$;

revoke all on function public.org_is_active(uuid) from public, anon;
revoke all on function public.org_access_allowed(uuid) from public, anon;
revoke all on function public.club_org_is_active(uuid) from public, anon;
revoke all on function public.tournament_org_is_active(uuid) from public, anon;
revoke all on function public.org_fence_exempt(text) from public, anon;
revoke all on function public.my_suspended_orgs() from public, anon;
grant execute on function public.org_is_active(uuid) to authenticated, service_role;
grant execute on function public.org_access_allowed(uuid) to authenticated, service_role;
grant execute on function public.club_org_is_active(uuid) to authenticated, service_role;
grant execute on function public.tournament_org_is_active(uuid) to authenticated, service_role;
grant execute on function public.org_fence_exempt(text) to service_role;
grant execute on function public.my_suspended_orgs() to authenticated;
