-- Phase 5b: the two port events, and RLS for the tournament side.
-- These two functions are the ONLY places data crosses the org fence, and both are
-- writes. No SELECT policy anywhere spans a tenant.

create or replace function public.roster_consent_granted(p_entry_id uuid, p_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.approval_requests a
    where a.subject_type = 'tournament_roster'
      and a.subject_id = p_entry_id
      and a.player_id = p_player_id
      and a.status = 'approved');
$$;

-- ============ PORT 1: at registration, the squad goes out ============
create or replace function public.port_squad_to_tournament(
  p_entry_id uuid,
  p_player_ids uuid[]
) returns table (player_id uuid, roster_id uuid, outcome text)
language plpgsql
security definer
set search_path = public
as $$
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

  -- only the entrant org's admin may disclose its players
  if not public.is_org_admin(v_entry.entrant_org_id) then
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

comment on function public.port_squad_to_tournament(uuid, uuid[]) is
  'PORT 1. Copies name, dob and jersey into the host org. Refuses any minor without an explicit approval. Audited in both orgs.';

-- ============ PORT 2: on verification, the results come home ============
create or replace function public.port_match_results_home(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match  public.matches%rowtype;
  v_tname  text;
  v_rows   int := 0;
  r        record;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'match % not found', p_match_id using errcode = 'no_data_found';
  end if;

  if not public.is_org_admin(v_match.org_id) then
    raise exception 'only the host org may publish results'
      using errcode = 'insufficient_privilege';
  end if;

  if not coalesce(v_match.verified, false) then
    raise exception 'match is not verified yet' using errcode = 'check_violation';
  end if;

  select name into v_tname from public.tournaments where id = v_match.tournament_id;

  for r in
    select tr.player_id,
           tr.source_org_id,
           count(*) filter (where me.type = 'goal')   as goals,
           count(*) filter (where me.type = 'assist') as assists,
           count(*) filter (where me.type in ('yellow','yellow_card')) as yellows,
           count(*) filter (where me.type in ('red','red_card'))       as reds
    from public.tournament_roster tr
    left join public.match_events me
      on me.player_id = tr.id and me.match_id = p_match_id
    where tr.tournament_id = v_match.tournament_id
      and tr.player_id is not null
      and tr.source_org_id is not null
      and tr.status = 'approved'
    group by tr.player_id, tr.source_org_id
  loop
    insert into public.player_tournament_results (
      org_id, player_id, tournament_id, tournament_name, host_org_id,
      match_id, match_date, goals, assists, yellow_cards, red_cards)
    values (
      r.source_org_id, r.player_id, v_match.tournament_id, coalesce(v_tname,'Tournament'),
      v_match.org_id, p_match_id, v_match.scheduled_at::date,
      r.goals, r.assists, r.yellows, r.reds)
    on conflict (player_id, match_id) do update set
      goals = excluded.goals, assists = excluded.assists,
      yellow_cards = excluded.yellow_cards, red_cards = excluded.red_cards,
      recorded_at = now();
    v_rows := v_rows + 1;
  end loop;

  perform public.write_audit(v_match.org_id, 'tournament.results.ported_home',
    'tournament', null, 'match', p_match_id::text, null,
    jsonb_build_object('player_rows', v_rows));

  return v_rows;
end $$;

comment on function public.port_match_results_home(uuid) is
  'PORT 2. Writes minutes, goals and cards into each player''s own club org. The only other place the fence is crossed.';

revoke all on function public.port_squad_to_tournament(uuid, uuid[]) from public, anon;
revoke all on function public.port_match_results_home(uuid) from public, anon;
grant execute on function public.port_squad_to_tournament(uuid, uuid[]) to authenticated;
grant execute on function public.port_match_results_home(uuid) to authenticated;

-- ---------- RLS ----------
alter table public.tournament_roster        enable row level security;
alter table public.tournament_members       enable row level security;
alter table public.org_officials            enable row level security;
alter table public.tournament_officials     enable row level security;
alter table public.player_tournament_results enable row level security;

-- Host sees its roster. The entrant sees only the rows it submitted (and why one was rejected).
create policy roster_host_read on public.tournament_roster for select to authenticated
  using (public.is_org_member(org_id));
create policy roster_entrant_read on public.tournament_roster for select to authenticated
  using (source_org_id is not null and public.is_org_member(source_org_id));
create policy roster_host_write on public.tournament_roster for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy tmembers_read on public.tournament_members for select to authenticated
  using (public.is_org_member(org_id) or user_id = auth.uid());
create policy tmembers_write on public.tournament_members for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- The pool never leaves its org. An official working two orgs is two rows, by design.
create policy officials_read on public.org_officials for select to authenticated
  using (public.is_org_member(org_id) or user_id = auth.uid());
create policy officials_write on public.org_officials for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy toff_read on public.tournament_officials for select to authenticated
  using (public.is_org_member(org_id)
         or exists (select 1 from public.org_officials o
                    where o.id = tournament_officials.official_id and o.user_id = auth.uid()));
create policy toff_write on public.tournament_officials for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- Results live in the club's org and follow the club's own visibility rules.
create policy ptr_read on public.player_tournament_results for select to authenticated
  using (public.is_org_member(org_id) and (
           public.is_guardian_of(player_id) or public.is_player_self(player_id)
           or exists (select 1 from public.players p
                      where p.id = player_tournament_results.player_id
                        and (public.is_assigned_to_team(p.team_id)
                             or public.can_read_club(player_tournament_results.org_id, p.club_id)))));
create policy ptr_write on public.player_tournament_results for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));;