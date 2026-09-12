-- Platform Admin cross-org troubleshooting (gap analysis 2026-09-11, §1.2:
-- "the backdoor for all orgs when troubleshooting"). Every existing view-as
-- mechanism is entitlement-scoped and requires that entitlement's own IT
-- role: club_it_admin's start_impersonation() takes a club_id;
-- tournament_it_admin has no equivalent at all today. Platform Admin -- the
-- one role meant to reach every org -- had no diagnostic path into any of
-- them beyond raw SQL with the service-role key. This is a THIRD, wider
-- tier of the same proven pattern, not a replacement for the other two:
-- club_it_admin keeps working within their club, tournament_it_admin keeps
-- working within their tournament, unchanged. This one is org-scoped (not
-- club_id-scoped), so it works for a Tournament-only org that has no club
-- at all, and for a Combined-entitlement org it can inspect both sides in
-- one session.
--
-- Same reasoning as phase6o for why this is a "view as" and not session
-- minting: the actor stays themselves, write_audit() keeps attributing
-- every action to the platform admin, never the target.

create table public.platform_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (length(btrim(reason)) > 0),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  constraint platform_impersonation_no_self check (actor_user_id <> target_user_id)
);

create index platform_impersonation_sessions_actor_idx
  on public.platform_impersonation_sessions (actor_user_id, ended_at, expires_at);
create index platform_impersonation_sessions_org_idx
  on public.platform_impersonation_sessions (org_id, started_at desc);

alter table public.platform_impersonation_sessions enable row level security;

-- Platform-only tooling: readable by the actor themselves, or any platform
-- admin reviewing usage of the capability -- deliberately NOT by
-- club_it_admin/tournament_it_admin, who have their own separate, narrower
-- mechanism and no business seeing platform-level sessions.
create policy "platform_impersonation_sessions read: actor or platform admin"
  on public.platform_impersonation_sessions for select to authenticated
  using (actor_user_id = auth.uid() or public.is_platform_admin());

revoke all on public.platform_impersonation_sessions from anon;

-- Does this user have ANY known relationship to this org, across both
-- entitlements? Generalizes is_org_member's own club-side checks (which are
-- keyed to auth.uid(), not a parameter, so cannot be reused directly) and
-- adds the tournament-side relationships that predate is_org_member's own
-- design by two days.
create or replace function public.is_user_in_org(p_user_id uuid, p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_org_id is not null and p_user_id is not null and (
    exists (select 1 from public.role_assignments ra
            where ra.user_id = p_user_id and ra.org_id = p_org_id)
    or exists (select 1 from public.org_members om
               where om.org_id = p_org_id and om.user_id = p_user_id)
    or exists (select 1 from public.club_staff cs
               join public.clubs c on c.id = cs.club_id
               where c.org_id = p_org_id and cs.user_id = p_user_id and cs.status = 'active')
    or exists (select 1 from public.user_assigned_teams uat
               join public.teams t on t.id = uat.team_id
               where t.org_id = p_org_id and uat.user_id = p_user_id)
    or exists (select 1 from public.guardians g
               join public.player_guardians pg on pg.guardian_id = g.id
               join public.players p on p.id = pg.player_id
               where p.org_id = p_org_id and g.user_id = p_user_id)
    or exists (select 1 from public.players p
               where p.org_id = p_org_id and p.user_id = p_user_id)
    or exists (select 1 from public.tournament_staff ts
               where ts.org_id = p_org_id and ts.user_id = p_user_id and ts.status = 'active')
    or exists (select 1 from public.tournament_entry_contacts tec
               where tec.org_id = p_org_id and tec.user_id = p_user_id and tec.account_status = 'active')
  );
$$;

revoke all on function public.is_user_in_org(uuid, uuid) from public, anon;
grant execute on function public.is_user_in_org(uuid, uuid) to authenticated, service_role;

create or replace function public.start_platform_impersonation(
  p_org_id uuid,
  p_target_user_id uuid,
  p_reason text,
  p_minutes int default 30
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_minutes int := least(greatest(coalesce(p_minutes, 30), 1), 120);
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'a reason is required';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'cannot view as yourself';
  end if;

  -- Platform admins are never impersonable, same rule as the club-scoped
  -- version -- there is no reason to widen this for the wider tier.
  if exists (
    select 1 from public.role_assignments ra
    where ra.user_id = p_target_user_id
      and ra.scope_type = 'platform' and ra.role = 'platform_admin'
  ) or exists (
    select 1 from public.platform_admins pa
    join auth.users u on lower(u.email) = lower(pa.email)
    where u.id = p_target_user_id
  ) then
    raise exception 'platform admins cannot be viewed as';
  end if;

  if not public.is_user_in_org(p_target_user_id, p_org_id) then
    raise exception 'that user has no known relationship to this organization';
  end if;

  update public.platform_impersonation_sessions
     set ended_at = now()
   where actor_user_id = auth.uid() and ended_at is null;

  insert into public.platform_impersonation_sessions
    (org_id, actor_user_id, target_user_id, reason, expires_at)
  values
    (p_org_id, auth.uid(), p_target_user_id, btrim(p_reason),
     now() + make_interval(mins => v_minutes))
  returning id into v_id;

  perform public.write_audit(p_org_id, 'security.platform_impersonation.started',
    'org', p_org_id, 'user', p_target_user_id::text, null,
    jsonb_build_object('reason', btrim(p_reason), 'session_id', v_id, 'expires_in_minutes', v_minutes));

  return v_id;
end;
$$;

create or replace function public.end_platform_impersonation(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_row public.platform_impersonation_sessions;
begin
  select * into v_row from public.platform_impersonation_sessions where id = p_session_id;
  if not found then return; end if;
  if v_row.actor_user_id <> auth.uid() and not public.is_platform_admin() then
    raise exception 'not your session';
  end if;
  if v_row.ended_at is not null then return; end if;

  update public.platform_impersonation_sessions set ended_at = now() where id = p_session_id;

  perform public.write_audit(v_row.org_id, 'security.platform_impersonation.ended',
    'org', v_row.org_id, 'user', v_row.target_user_id::text, null,
    jsonb_build_object('session_id', p_session_id));
end;
$$;

create or replace function public.my_active_platform_impersonation()
returns table (
  session_id uuid,
  org_id uuid,
  org_name text,
  target_user_id uuid,
  target_name text,
  reason text,
  expires_at timestamptz
) language sql stable security definer set search_path = public as $$
  select s.id, s.org_id, o.name, s.target_user_id, u.name, s.reason, s.expires_at
  from public.platform_impersonation_sessions s
  join public.organizations o on o.id = s.org_id
  left join public.users u on u.id = s.target_user_id
  where s.actor_user_id = auth.uid()
    and s.ended_at is null
    and s.expires_at > now()
  order by s.started_at desc
  limit 1;
$$;

revoke all on function public.start_platform_impersonation(uuid, uuid, text, int) from public, anon;
revoke all on function public.end_platform_impersonation(uuid) from public, anon;
revoke all on function public.my_active_platform_impersonation() from public, anon;
grant execute on function public.start_platform_impersonation(uuid, uuid, text, int) to authenticated;
grant execute on function public.end_platform_impersonation(uuid) to authenticated;
grant execute on function public.my_active_platform_impersonation() to authenticated;
