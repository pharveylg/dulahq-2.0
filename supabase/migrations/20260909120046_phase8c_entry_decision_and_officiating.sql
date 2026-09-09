-- Entry decisions get a real RPC, not a raw RLS policy, so they're audited
-- from day one -- the club side needed a whole P0 batch item (phase6z) to
-- retrofit audit calls onto actions that had shipped without them; no
-- reason to repeat that lesson here now that it's already learned.
--
-- Deliberately does NOT touch te_host_write's existing org_admin-only
-- blanket policy (insert/update/delete on tournament_entries) -- this RPC
-- adds a second, narrower path for the specific "accept or reject" action,
-- gated on decide_tournament_entry, OR'd alongside the org_admin path
-- everything else on this table still uses.
--
-- NOTE: p_status here used 'rejected', which tournament_entries' own CHECK
-- constraint doesn't allow (pending/accepted/declined/withdrawn) -- caught
-- on first live test, fixed same-session in phase8c1.
create or replace function public.decide_tournament_entry(p_entry_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_entry public.tournament_entries%rowtype;
  v_tournament public.tournaments%rowtype;
begin
  if p_status not in ('accepted', 'rejected') then
    raise exception 'status must be accepted or rejected' using errcode = 'check_violation';
  end if;

  select * into v_entry from public.tournament_entries where id = p_entry_id;
  if not found then
    raise exception 'entry % not found', p_entry_id using errcode = 'no_data_found';
  end if;

  select * into v_tournament from public.tournaments where id = v_entry.tournament_id;

  if not (
    public.has_tournament_permission('decide_tournament_entry', v_entry.tournament_id)
    or public.is_org_admin(v_entry.host_org_id)
  ) then
    raise exception 'not authorised to decide this entry' using errcode = 'insufficient_privilege';
  end if;

  update public.tournament_entries set status = p_status where id = p_entry_id;

  perform public.write_audit(v_entry.host_org_id,
    case when p_status = 'accepted' then 'tournament_entry.accepted' else 'tournament_entry.rejected' end,
    'tournament', v_entry.tournament_id, 'tournament_entry', p_entry_id::text,
    jsonb_build_object('status', v_entry.status), jsonb_build_object('status', p_status));
end $$;

revoke all on function public.decide_tournament_entry(uuid, text) from public;
revoke all on function public.decide_tournament_entry(uuid, text) from anon;
grant execute on function public.decide_tournament_entry(uuid, text) to authenticated;
grant execute on function public.decide_tournament_entry(uuid, text) to service_role;

-- Officiating: tournament_officials (assignment to THIS tournament's
-- matches) gets Referee Coordinator's permission. org_officials (the org's
-- whole pool of officials, spanning every tournament that org runs, no
-- tournament_id column at all) deliberately stays org_admin-only -- it
-- genuinely isn't tournament-scoped data, so forcing it through
-- has_tournament_permission would mean picking one arbitrary tournament's
-- Referee Coordinator to authorize a change to an org-wide resource, which
-- doesn't have a principled answer.
drop policy if exists toff_write on public.tournament_officials;
create policy toff_write on public.tournament_officials for all to authenticated
using (public.is_org_admin(org_id) or public.has_tournament_permission('manage_officiating', tournament_id))
with check (public.is_org_admin(org_id) or public.has_tournament_permission('manage_officiating', tournament_id));

-- support_requests: widen eligibility to also recognize tournament_staff,
-- fulfilling the promise made when this table was built (phase7e) --
-- "generic over org_id from day one... needs zero changes for Tournament".
-- The schema needed none; only the eligibility predicate gets a second
-- OR-branch, mirroring the existing club_staff one exactly.
drop policy if exists support_requests_read on public.support_requests;
create policy support_requests_read on public.support_requests for select to authenticated
using (
  created_by = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1 from public.club_staff cs join public.clubs c on c.id = cs.club_id
    where c.org_id = support_requests.org_id and cs.user_id = auth.uid() and cs.status = 'active'
      and public.has_staff_permission('submit_support_request', cs.club_id)
  )
  or exists (
    select 1 from public.tournament_staff ts
    where ts.org_id = support_requests.org_id and ts.user_id = auth.uid() and ts.status = 'active'
      and public.has_tournament_permission('submit_support_request', ts.tournament_id)
  )
);

drop policy if exists support_requests_insert on public.support_requests;
create policy support_requests_insert on public.support_requests for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_org_admin(org_id)
    or exists (
      select 1 from public.club_staff cs join public.clubs c on c.id = cs.club_id
      where c.org_id = support_requests.org_id and cs.user_id = auth.uid() and cs.status = 'active'
        and public.has_staff_permission('submit_support_request', cs.club_id)
    )
    or exists (
      select 1 from public.tournament_staff ts
      where ts.org_id = support_requests.org_id and ts.user_id = auth.uid() and ts.status = 'active'
        and public.has_tournament_permission('submit_support_request', ts.tournament_id)
    )
  )
);
