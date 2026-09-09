-- External Organization access (docs/specs, "tournament.md" proposal review,
-- 2026-09-09 decision 3): a team registering from OUTSIDE Dula HQ has no
-- club and no org membership, so there's no club_staff/tournament_staff row
-- to hang a permission bundle on. The registration form lists who should
-- get access once the entry is approved; access itself is provisioned by
-- an email-match self-claim, same spirit as the guardian invite flow
-- (account_status/self-claim-by-email), but with an EXPLICIT, narrow RLS
-- predicate rather than inherited assumptions -- checking guardians_read's
-- actual policy while building this surfaced that its own "own pending
-- invite" claim depends on is_staff_in_org(org_id), which a genuinely cold
-- invitee (no prior org relationship at all) would fail. Not fixed here --
-- out of scope for this pass, flagged for its own look -- but not repeated
-- here: this table's claim predicate matches ONLY on email, no org
-- relationship required, which is what a cold external contact needs.
create table public.tournament_entry_contacts (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.tournament_entries(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('team_manager', 'coach')),
  -- pending: captured on the registration form, purely informational --
  -- matches the proposal's own "Coach... captured as team information
  -- unless the tournament requires it". invited: flipped on entry
  -- acceptance (decide_tournament_entry, below), ready to be claimed.
  -- active: claimed, user_id linked. revoked: access pulled without
  -- deleting the record -- same archive-don't-delete lesson as
  -- club_staff.status, applied from day one this time.
  account_status text not null default 'pending' check (account_status in ('pending', 'invited', 'active', 'revoked')),
  user_id uuid references public.users(id) on delete set null,
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.tournament_entry_contacts enable row level security;

-- Visible to: the org that owns the entry (host staff reviewing/managing
-- contacts), OR a signed-in user whose OWN email matches an invited/active
-- row -- no prior relationship to the org required, which is the entire
-- point (a cold external contact has none). lower() on both sides so case
-- never silently breaks the match.
create policy tec_read on public.tournament_entry_contacts for select to authenticated
using (
  public.can_read_tournament(org_id, (select te.tournament_id from public.tournament_entries te where te.id = entry_id))
  or (
    account_status in ('invited', 'active')
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  or user_id = auth.uid()
);

-- Contacts are captured at registration time (public.tournament_entries'
-- own te_entrant_apply policy already lets an entrant org_admin insert an
-- entry; this table follows the same entry-scoped shape) and managed by
-- whoever can administer the tournament thereafter.
create policy tec_write on public.tournament_entry_contacts for all to authenticated
using (public.can_read_tournament(org_id, (select te.tournament_id from public.tournament_entries te where te.id = entry_id)))
with check (public.can_read_tournament(org_id, (select te.tournament_id from public.tournament_entries te where te.id = entry_id)));

-- The claimant themselves may link their own account once invited/active --
-- separate, narrower policy so tec_write's tournament-admin path doesn't
-- have to also account for self-claim.
create policy tec_self_claim on public.tournament_entry_contacts for update to authenticated
using (account_status in ('invited', 'active') and lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
with check (user_id = auth.uid() and account_status = 'active');

-- Entry-scoped authority for the claimed contact -- mirrors
-- is_assigned_to_team(): a fact about one specific assignment, not a role
-- with a permission bundle. min_role narrows to exactly team_manager where
-- the calling code needs the fuller authority (team_manager gets roster/
-- document/status actions; coach, if ever invited, gets less).
create or replace function public.is_tournament_entry_contact(p_entry_id uuid, min_role text default null)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tournament_entry_contacts tec
    where tec.entry_id = p_entry_id
      and tec.user_id = auth.uid()
      and tec.account_status = 'active'
      and (min_role is null or tec.role = min_role)
  );
$$;

revoke all on function public.is_tournament_entry_contact(uuid, text) from public;
revoke all on function public.is_tournament_entry_contact(uuid, text) from anon;
grant execute on function public.is_tournament_entry_contact(uuid, text) to authenticated;
grant execute on function public.is_tournament_entry_contact(uuid, text) to service_role;

-- decide_tournament_entry: on acceptance, flip the team_manager contact to
-- invited automatically -- "once approved, access will be provisioned"
-- (decision 3) as a direct consequence of the accept, not a second manual
-- step. Coach contacts stay pending -- inviting them is a deliberate,
-- separate act (the proposal's own "optional... unless the tournament
-- requires it"), not automatic.
create or replace function public.decide_tournament_entry(p_entry_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_entry public.tournament_entries%rowtype;
begin
  if p_status not in ('accepted', 'declined') then
    raise exception 'status must be accepted or declined' using errcode = 'check_violation';
  end if;

  select * into v_entry from public.tournament_entries where id = p_entry_id;
  if not found then
    raise exception 'entry % not found', p_entry_id using errcode = 'no_data_found';
  end if;

  if not (
    public.has_tournament_permission('decide_tournament_entry', v_entry.tournament_id)
    or public.is_org_admin(v_entry.host_org_id)
  ) then
    raise exception 'not authorised to decide this entry' using errcode = 'insufficient_privilege';
  end if;

  update public.tournament_entries set status = p_status where id = p_entry_id;

  if p_status = 'accepted' then
    update public.tournament_entry_contacts
       set account_status = 'invited', invited_at = now()
     where entry_id = p_entry_id and role = 'team_manager' and account_status = 'pending';
  end if;

  perform public.write_audit(v_entry.host_org_id,
    case when p_status = 'accepted' then 'tournament_entry.accepted' else 'tournament_entry.declined' end,
    'tournament', v_entry.tournament_id, 'tournament_entry', p_entry_id::text,
    jsonb_build_object('status', v_entry.status), jsonb_build_object('status', p_status));
end $$;
