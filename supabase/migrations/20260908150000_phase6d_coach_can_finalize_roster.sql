-- Phase 6d: let a coach/team_manager finalize their own team's tournament
-- roster, not just an org_admin.
--
-- port_squad_to_tournament() (phase5b, 2026-09-07) hardcoded
-- `is_org_admin(v_entry.entrant_org_id)` as its only authorization path --
-- "only the entrant org's admin may disclose its players". That's a real
-- gap against the Coach Module spec's actual workflow ("The Coach should
-- have a Finalize Roster action"): org_admin (org_members.role='admin') is
-- a different person from the club's coach in practice, and wasn't even
-- club staff necessarily. Extending the check to also accept Phase 0's
-- finalize_tournament_roster permission, scoped to the entry's own
-- club_id/team_id -- exactly the permission phase6a's catalog defined for
-- this, unused until now.
--
-- Entries with no club_id/team_id (a "visiting"/fictional entry not tied to
-- a real club -- see the showcase seed's national-team-style entries) have
-- no coach to authorize at all; org_admin stays the only path for those,
-- unchanged.
--
-- Rest of the function body is byte-identical to the original phase5b
-- definition -- only the authorization check changes.
create or replace function public.port_squad_to_tournament(p_entry_id uuid, p_player_ids uuid[])
returns table(player_id uuid, roster_id uuid, outcome text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_entry   public.tournament_entries%rowtype;
  v_player  public.players%rowtype;
  v_pid     uuid;
  v_roster  uuid;
  v_needs   boolean;
  v_ok      boolean;
  v_count   int := 0;
begin
  select * into v_entry from public.tournament_entries where id = p_entry_id;
  if not found then
    raise exception 'entry % not found', p_entry_id using errcode = 'no_data_found';
  end if;

  -- the entrant org's admin may always disclose its players; so can a
  -- coach/team_manager holding finalize_tournament_roster for the specific
  -- club/team this entry belongs to.
  if not (
    public.is_org_admin(v_entry.entrant_org_id)
    or (v_entry.club_id is not null and public.has_staff_permission('finalize_tournament_roster', v_entry.club_id, v_entry.team_id))
  ) then
    raise exception 'not authorised to submit a roster for this entry'
      using errcode = 'insufficient_privilege';
  end if;

  if v_entry.status <> 'accepted' then
    raise exception 'entry is % - it must be accepted before a roster is submitted', v_entry.status
      using errcode = 'check_violation';
  end if;

  foreach v_pid in array coalesce(p_player_ids, '{}'::uuid[]) loop
    select * into v_player from public.players where id = v_pid;

    if not found or v_player.org_id is distinct from v_entry.entrant_org_id then
      player_id := v_pid; roster_id := null; outcome := 'not_your_player';
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
      player_id, source_org_id, consent_on_file, created_by)
    values (
      v_entry.host_org_id, v_entry.tournament_id, p_entry_id,
      v_player.name, v_player.dob, v_player.jersey, v_player.position,
      v_pid, v_entry.entrant_org_id, (v_ok or not v_needs), auth.uid())
    returning id into v_roster;

    v_count := v_count + 1;
    player_id := v_pid; roster_id := v_roster; outcome := 'ported';
    return next;
  end loop;

  -- the crossing lands in both logs
  perform public.write_audit(v_entry.entrant_org_id, 'tournament.roster.ported_out',
    'tournament', null, 'tournament_entry', p_entry_id::text, null,
    jsonb_build_object('players', v_count, 'host_org', v_entry.host_org_id));
  perform public.write_audit(v_entry.host_org_id, 'tournament.roster.received',
    'tournament', null, 'tournament_entry', p_entry_id::text, null,
    jsonb_build_object('players', v_count, 'from_org', v_entry.entrant_org_id));
end $function$;
