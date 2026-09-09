-- Roster versioning. CLAUDE.md §0c Phase 3 recorded "no roster versioning --
-- a tournament_roster row is final the moment it's created; there's no
-- unfinalize or edit-after-port path", and §0f folded the spec's "Locked"
-- into "Finalized" for exactly that reason. Consequence in practice: a late
-- withdrawal or an injury had no supported fix short of database surgery.
--
-- Two ints carry the whole thing, so point-in-time reconstruction needs no
-- second table and no stored roster status (§0f's derived-never-stored rule
-- still holds -- these record *when* a row entered and left, which is a fact
-- about the row, not a summary of anything else):
--
--   roster at revision N =
--     added_in_revision <= N
--     and (withdrawn_in_revision is null or withdrawn_in_revision > N)
--
-- tournament_roster.status already permitted 'withdrawn' since phase5a and
-- nothing had ever written it. This is what it was for.

alter table public.tournament_entries
  add column if not exists roster_revision int not null default 0;

alter table public.tournament_roster
  add column if not exists added_in_revision int not null default 1,
  add column if not exists withdrawn_in_revision int;

-- Everything already ported is revision 1 by definition; an entry with no
-- roster rows has never been finalized, so it stays at 0.
update public.tournament_entries e
   set roster_revision = 1
 where roster_revision = 0
   and exists (select 1 from public.tournament_roster r where r.entry_id = e.id);

comment on column public.tournament_entries.roster_revision is
  'Bumped by every finalize that ports someone and by every withdrawal. 0 = never finalized.';
comment on column public.tournament_roster.withdrawn_in_revision is
  'Null while the player is on the roster. Set with status=''withdrawn''; the row is kept as history, never deleted.';

-- --------------------------------------------------------------------------
-- Withdrawal
-- --------------------------------------------------------------------------
create or replace function public.withdraw_from_tournament_roster(
  p_roster_id uuid,
  p_reason    text
)
returns table (withdrawn_player_id uuid, withdrawn_name text, new_revision int)
language plpgsql security definer set search_path = public as $$
declare
  v_row   public.tournament_roster%rowtype;
  v_entry public.tournament_entries%rowtype;
  v_rev   int;
begin
  select * into v_row from public.tournament_roster where id = p_roster_id;
  if not found then
    raise exception 'roster entry % not found', p_roster_id using errcode = 'no_data_found';
  end if;

  select * into v_entry from public.tournament_entries where id = v_row.entry_id;
  if not found then
    raise exception 'entry % not found', v_row.entry_id using errcode = 'no_data_found';
  end if;

  -- Deliberately byte-identical to port_squad_to_tournament's gate (phase6t):
  -- taking a player off a finalized roster is the same authority as putting
  -- one on it, so a club-backed entry needs finalize_tournament_roster on
  -- that club/team and an org admin cannot override the club's own coach
  -- (Club Manager spec §29), while a club-less entry -- an external team with
  -- no club staff who could ever hold the permission -- still falls back to
  -- the entrant org's admin.
  if not (
    case
      when v_entry.club_id is not null
        then public.has_staff_permission('finalize_tournament_roster', v_entry.club_id, v_entry.team_id)
      else public.is_org_admin(v_entry.entrant_org_id)
    end
  ) then
    raise exception 'not authorised to change this roster'
      using errcode = 'insufficient_privilege';
  end if;

  if v_row.status = 'withdrawn' then
    raise exception '% has already been withdrawn from this roster', v_row.full_name
      using errcode = 'check_violation';
  end if;

  -- Same rule the guardian decline path already enforces: an irreversible
  -- change to someone's participation has to say why.
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'a reason is required to withdraw a player from a finalized roster'
      using errcode = 'check_violation';
  end if;

  v_rev := v_entry.roster_revision + 1;
  update public.tournament_entries set roster_revision = v_rev where id = v_entry.id;

  update public.tournament_roster
     set status                = 'withdrawn',
         reject_reason         = btrim(p_reason),
         withdrawn_in_revision = v_rev
   where id = p_roster_id;

  -- The proposal has to let go of them too, or the very next finalize would
  -- port them straight back in. Re-adding a withdrawn player is therefore a
  -- deliberate act: propose again, then finalize again.
  if v_row.player_id is not null then
    delete from public.tournament_roster_candidates c
     where c.entry_id = v_entry.id and c.player_id = v_row.player_id;
  end if;

  -- The crossing landed in both logs on the way in; leaving lands in both too.
  perform public.write_audit(v_entry.entrant_org_id, 'tournament.roster.withdrawn',
    'tournament', null, 'tournament_entry', v_entry.id::text,
    jsonb_build_object('player', v_row.full_name, 'status', v_row.status),
    jsonb_build_object('player', v_row.full_name, 'status', 'withdrawn',
                       'reason', btrim(p_reason), 'revision', v_rev));
  perform public.write_audit(v_entry.host_org_id, 'tournament.roster.withdrawal_received',
    'tournament', null, 'tournament_entry', v_entry.id::text, null,
    jsonb_build_object('player', v_row.full_name, 'reason', btrim(p_reason),
                       'revision', v_rev, 'from_org', v_entry.entrant_org_id));

  withdrawn_player_id := v_row.player_id;
  withdrawn_name      := v_row.full_name;
  new_revision        := v_rev;
  return next;
end $$;

-- phase6s: EXECUTE defaults to PUBLIC on creation, and anon inherits PUBLIC.
revoke all on function public.withdraw_from_tournament_roster(uuid, text) from public;
revoke all on function public.withdraw_from_tournament_roster(uuid, text) from anon;
grant execute on function public.withdraw_from_tournament_roster(uuid, text) to authenticated;
grant execute on function public.withdraw_from_tournament_roster(uuid, text) to service_role;

-- --------------------------------------------------------------------------
-- The port, made revision-aware and idempotent
-- --------------------------------------------------------------------------
-- Two changes, both forced by withdrawal existing:
--   * a player already on the roster is reported 'already_rostered' instead
--     of being inserted a second time. Without this, re-finalizing an
--     unchanged roster silently duplicated every player -- harmless while
--     finalize was a once-per-entry act, a real bug now that withdraw-then-
--     re-finalize is the supported repair path.
--   * ported rows are stamped with the revision they entered in, and the
--     entry's revision only moves when someone actually crosses.
-- The authorization gate is phase6t's, unchanged.
create or replace function public.port_squad_to_tournament(p_entry_id uuid, p_player_ids uuid[])
returns table (player_id uuid, roster_id uuid, outcome text)
language plpgsql security definer set search_path = public as $$
declare
  v_entry   public.tournament_entries%rowtype;
  v_player  public.players%rowtype;
  v_pid     uuid;
  v_roster  uuid;
  v_needs   boolean;
  v_ok      boolean;
  v_rev     int;
  v_count   int := 0;
begin
  select * into v_entry from public.tournament_entries where id = p_entry_id;
  if not found then
    raise exception 'entry % not found', p_entry_id using errcode = 'no_data_found';
  end if;

  if not (
    case
      when v_entry.club_id is not null
        then public.has_staff_permission('finalize_tournament_roster', v_entry.club_id, v_entry.team_id)
      else public.is_org_admin(v_entry.entrant_org_id)
    end
  ) then
    raise exception 'not authorised to submit a roster for this entry'
      using errcode = 'insufficient_privilege';
  end if;

  if v_entry.status <> 'accepted' then
    raise exception 'entry is % - it must be accepted before a roster is submitted', v_entry.status
      using errcode = 'check_violation';
  end if;

  v_rev := v_entry.roster_revision + 1;

  foreach v_pid in array coalesce(p_player_ids, '{}'::uuid[]) loop
    select * into v_player from public.players where id = v_pid;

    if not found or v_player.org_id is distinct from v_entry.entrant_org_id then
      player_id := v_pid; roster_id := null; outcome := 'not_your_player';
      return next; continue;
    end if;

    -- Already on the roster and not withdrawn: nothing to do, and inserting
    -- would duplicate them.
    if exists (
      select 1 from public.tournament_roster r
       where r.entry_id = p_entry_id and r.player_id = v_pid and r.status <> 'withdrawn'
    ) then
      player_id := v_pid; roster_id := null; outcome := 'already_rostered';
      return next; continue;
    end if;

    v_needs := public.requires_guardian_consent(v_pid);
    v_ok    := public.roster_consent_granted(p_entry_id, v_pid);

    if v_needs and not v_ok then
      player_id := v_pid; roster_id := null; outcome := 'consent_missing';
      return next; continue;
    end if;

    -- the field list IS the contract: name, dob, jersey. Nothing else crosses.
    insert into public.tournament_roster (
      org_id, tournament_id, entry_id, full_name, dob, jersey, position,
      player_id, source_org_id, consent_on_file, created_by, added_in_revision)
    values (
      v_entry.host_org_id, v_entry.tournament_id, p_entry_id,
      v_player.name, v_player.dob, v_player.jersey, v_player.position,
      v_pid, v_entry.entrant_org_id, (v_ok or not v_needs), auth.uid(), v_rev)
    returning id into v_roster;

    v_count := v_count + 1;
    player_id := v_pid; roster_id := v_roster; outcome := 'ported';
    return next;
  end loop;

  -- A finalize that ported nobody is not a new revision, and does not deserve
  -- an audit row in two orgs -- which it would now get routinely, since
  -- re-finalizing an unchanged roster is an ordinary no-op.
  if v_count > 0 then
    update public.tournament_entries set roster_revision = v_rev where id = p_entry_id;

    perform public.write_audit(v_entry.entrant_org_id, 'tournament.roster.ported_out',
      'tournament', null, 'tournament_entry', p_entry_id::text, null,
      jsonb_build_object('players', v_count, 'host_org', v_entry.host_org_id, 'revision', v_rev));
    perform public.write_audit(v_entry.host_org_id, 'tournament.roster.received',
      'tournament', null, 'tournament_entry', p_entry_id::text, null,
      jsonb_build_object('players', v_count, 'from_org', v_entry.entrant_org_id, 'revision', v_rev));
  end if;
end $$;

revoke all on function public.port_squad_to_tournament(uuid, uuid[]) from public;
revoke all on function public.port_squad_to_tournament(uuid, uuid[]) from anon;
grant execute on function public.port_squad_to_tournament(uuid, uuid[]) to authenticated;
grant execute on function public.port_squad_to_tournament(uuid, uuid[]) to service_role;
