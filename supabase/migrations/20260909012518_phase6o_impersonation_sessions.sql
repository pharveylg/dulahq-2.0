-- Club Admin spec §10, implemented as a logged "view as" rather than session
-- minting. The spec's own requirements rule minting out: #5 "the original
-- Club Admin identity must remain attached to all audit records" and #6 "the
-- impersonated user must not be treated as the actor in the underlying audit
-- record" are impossible if the admin's browser holds the target's JWT --
-- write_audit() keys off auth.uid(), so every action would be attributed to
-- the victim and be indistinguishable from account takeover.
--
-- So: the admin stays themselves. Starting a session records who/whom/why,
-- expires on its own, and unlocks a read-only readout of the target's
-- effective access. Nothing here can write as the target.

create table public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (length(btrim(reason)) > 0),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  constraint impersonation_no_self check (actor_user_id <> target_user_id)
);

create index impersonation_sessions_actor_idx
  on public.impersonation_sessions (actor_user_id, ended_at, expires_at);
create index impersonation_sessions_club_idx
  on public.impersonation_sessions (club_id, started_at desc);

alter table public.impersonation_sessions enable row level security;

-- Readable by the actor, and by anyone who may review the club's audit
-- trail. Deliberately no INSERT/UPDATE/DELETE policy at all: rows are
-- created and closed only through the SECURITY DEFINER functions below, and
-- nobody -- including the actor -- can erase or backdate one.
create policy "impersonation_sessions read: actor or audit reviewer"
  on public.impersonation_sessions for select to authenticated
  using (
    actor_user_id = auth.uid()
    or public.has_staff_permission('view_audit_log', club_id)
    or public.is_platform_admin()
  );

revoke all on public.impersonation_sessions from anon;

-- ---------- start ----------
create or replace function public.start_impersonation(
  p_target_user_id uuid,
  p_club_id uuid,
  p_reason text,
  p_minutes int default 30
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_id uuid;
  v_minutes int := least(greatest(coalesce(p_minutes, 30), 1), 120);
begin
  if not public.has_staff_permission('impersonate_user', p_club_id) then
    raise exception 'not authorized to view as another user in this club';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'a reason is required';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'cannot view as yourself';
  end if;

  select org_id into v_org_id from public.clubs where id = p_club_id;
  if v_org_id is null then
    raise exception 'club not found';
  end if;

  -- Spec §10 requirement 7: platform admins are never impersonable.
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

  -- The target must actually belong to this club, so this can't be used to
  -- reach across tenants.
  if not exists (
    select 1 from public.club_staff cs where cs.club_id = p_club_id and cs.user_id = p_target_user_id
  ) and not exists (
    select 1 from public.players p where p.club_id = p_club_id and p.user_id = p_target_user_id
  ) and not exists (
    select 1 from public.guardians g
    join public.player_guardians pg on pg.guardian_id = g.id
    join public.players p on p.id = pg.player_id
    where g.user_id = p_target_user_id and p.club_id = p_club_id
  ) then
    raise exception 'that user is not a member of this club';
  end if;

  -- One active session per actor/target pair; close any earlier one first.
  update public.impersonation_sessions
     set ended_at = now()
   where actor_user_id = auth.uid() and ended_at is null;

  insert into public.impersonation_sessions
    (org_id, club_id, actor_user_id, target_user_id, reason, expires_at)
  values
    (v_org_id, p_club_id, auth.uid(), p_target_user_id, btrim(p_reason),
     now() + make_interval(mins => v_minutes))
  returning id into v_id;

  perform public.write_audit(v_org_id, 'security.impersonation.started',
    'club', p_club_id, 'user', p_target_user_id::text, null,
    jsonb_build_object('reason', btrim(p_reason), 'session_id', v_id, 'expires_in_minutes', v_minutes));

  return v_id;
end;
$$;

-- ---------- end ----------
create or replace function public.end_impersonation(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_row public.impersonation_sessions;
begin
  select * into v_row from public.impersonation_sessions where id = p_session_id;
  if not found then
    return;
  end if;
  if v_row.actor_user_id <> auth.uid() and not public.is_platform_admin() then
    raise exception 'not your session';
  end if;
  if v_row.ended_at is not null then
    return;
  end if;

  update public.impersonation_sessions set ended_at = now() where id = p_session_id;

  perform public.write_audit(v_row.org_id, 'security.impersonation.ended',
    'club', v_row.club_id, 'user', v_row.target_user_id::text, null,
    jsonb_build_object('session_id', p_session_id));
end;
$$;

-- ---------- the actor's own active session ----------
create or replace function public.my_active_impersonation()
returns table (
  session_id uuid,
  club_id uuid,
  target_user_id uuid,
  target_name text,
  reason text,
  expires_at timestamptz
) language sql stable security definer set search_path = public as $$
  select s.id, s.club_id, s.target_user_id, u.name, s.reason, s.expires_at
  from public.impersonation_sessions s
  left join public.users u on u.id = s.target_user_id
  where s.actor_user_id = auth.uid()
    and s.ended_at is null
    and s.expires_at > now()
  order by s.started_at desc
  limit 1;
$$;

revoke all on function public.start_impersonation(uuid, uuid, text, int) from public, anon;
revoke all on function public.end_impersonation(uuid) from public, anon;
revoke all on function public.my_active_impersonation() from public, anon;
grant execute on function public.start_impersonation(uuid, uuid, text, int) to authenticated;
grant execute on function public.end_impersonation(uuid) to authenticated;
grant execute on function public.my_active_impersonation() to authenticated;
