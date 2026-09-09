-- Found while verifying the P0-3 audit view: audit_log's own SELECT policy
-- is `is_platform_admin() or is_org_admin(org_id)` -- a club_manager, who
-- generally is NOT an org_admin (same recurring fact as phase6x's team-
-- assignment bug), holds view_audit_log in their permission bundle but
-- cannot read a single row of the table it's supposed to gate. Confirmed
-- live: a club_manager's own audit view showed "no activity" for an action
-- that had, in fact, just been written and correctly scope_id-tagged to
-- their club.
--
-- Fixed the same way it_club_directory/club_staff_directory already fixed
-- the analogous read-vs-write-policy mismatch: a narrow SECURITY DEFINER
-- RPC gated on has_staff_permission, rather than widening audit_log's own
-- RLS (which also protects org-wide and tournament-scoped rows this page
-- has no business reading).
create or replace function public.club_audit_log(p_club_id uuid)
returns table (id bigint, ts timestamptz, actor_email text, action text, entity_type text, entity_id text, before jsonb, after jsonb)
language sql stable security definer set search_path = public as $$
  select a.id, a.ts, a.actor_email, a.action, a.entity_type, a.entity_id, a.before, a.after
  from public.audit_log a
  where a.scope_type = 'club'
    and a.scope_id = p_club_id
    and public.has_staff_permission('view_audit_log', p_club_id)
  order by a.ts desc
  limit 50;
$$;

revoke all on function public.club_audit_log(uuid) from public;
revoke all on function public.club_audit_log(uuid) from anon;
grant execute on function public.club_audit_log(uuid) to authenticated;
grant execute on function public.club_audit_log(uuid) to service_role;
