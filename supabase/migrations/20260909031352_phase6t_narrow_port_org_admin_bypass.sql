-- Tier 0 (CLAUDE.md §0g). Club Manager spec §29 forbids a generic admin
-- override on roster finalization: "Do not allow Club Manager to bypass
-- Coach finalization through a generic admin override."
-- port_squad_to_tournament granted is_org_admin(entrant_org_id)
-- unconditionally, which is exactly that -- an org admin could finalize any
-- club's roster over the head of the coach and team manager who own it.
--
-- Deleting the bypass outright would have been wrong, though: 29 of 33
-- entries in this database have no club_id at all. Those are external teams
-- a host org entered directly, with no Dula HQ club and therefore no club
-- staff who could ever hold finalize_tournament_roster -- removing the
-- org-admin path would have made them permanently unfinalizable.
--
-- So the bypass is narrowed rather than removed: org admin remains the
-- authority for club-less entries (nobody else can be), and a club-backed
-- entry now requires the permission, so the club's own people decide their
-- own roster.
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
  v_count   int := 0;
begin
  select * into v_entry from public.tournament_entries where id = p_entry_id;
  if not found then
    raise exception 'entry % not found', p_entry_id using errcode = 'no_data_found';
  end if;

  -- A club-backed entry belongs to that club's staff: finalizing it requires
  -- finalize_tournament_roster on the specific club/team, and an org admin
  -- does NOT get to override them (spec §29). An entry with no club is an
  -- external team the host org manages directly -- there is no club staff to
  -- ask, so the entrant org's admin remains the only possible authority.
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
end $$;

revoke all on function public.port_squad_to_tournament(uuid, uuid[]) from public;
revoke all on function public.port_squad_to_tournament(uuid, uuid[]) from anon;
grant execute on function public.port_squad_to_tournament(uuid, uuid[]) to authenticated;
grant execute on function public.port_squad_to_tournament(uuid, uuid[]) to service_role;
