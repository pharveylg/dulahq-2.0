-- Phase 2b: org_id on every tenant-owned table, so every policy opens the same way.
-- Tables are empty, so NOT NULL is safe. A derivation trigger fills org_id from the
-- parent row when the caller doesn't supply it, so existing insert paths keep working.

create or replace function public.fill_org_id_from_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_table text := tg_argv[0];
  v_parent_key   text := tg_argv[1];
  v_parent_id    uuid;
  v_org          uuid;
begin
  if new.org_id is not null then
    return new;
  end if;
  execute format('select ($1).%I', v_parent_key) into v_parent_id using new;
  if v_parent_id is null then
    return new;
  end if;
  execute format('select org_id from public.%I where id = $1', v_parent_table)
    into v_org using v_parent_id;
  new.org_id := v_org;
  return new;
end $$;

do $mig$
declare
  all_tables constant text[] := array[
    'teams','club_staff','team_staff','user_assigned_teams','players',
    'player_guardians','attendance','training_sessions','session_drills','drills',
    'player_evaluations','player_skill_ratings','development_goals',
    'development_goal_drills','player_development_notes','fee_charges','payments',
    'memberships','membership_export_requests','trips','trip_passengers',
    'trip_transportation','announcements','announcement_reads','meetings',
    'meeting_action_items','media','expenses','document_uploads','match_events',
    'live_embeds','guardians','matches','registrations','referees',
    'officiating_team','access_requests'
  ];
  parents constant text[][] := array[
    ['teams','clubs','club_id'],
    ['club_staff','clubs','club_id'],
    ['team_staff','teams','team_id'],
    ['user_assigned_teams','teams','team_id'],
    ['players','teams','team_id'],
    ['player_guardians','players','player_id'],
    ['attendance','training_sessions','training_session_id'],
    ['training_sessions','clubs','club_id'],
    ['session_drills','training_sessions','session_id'],
    ['drills','clubs','club_id'],
    ['player_evaluations','clubs','club_id'],
    ['player_skill_ratings','player_evaluations','evaluation_id'],
    ['development_goals','clubs','club_id'],
    ['development_goal_drills','development_goals','goal_id'],
    ['player_development_notes','clubs','club_id'],
    ['fee_charges','clubs','club_id'],
    ['payments','fee_charges','fee_charge_id'],
    ['memberships','clubs','club_id'],
    ['membership_export_requests','clubs','club_id'],
    ['trips','clubs','club_id'],
    ['trip_passengers','trips','trip_id'],
    ['trip_transportation','trips','trip_id'],
    ['announcements','clubs','club_id'],
    ['announcement_reads','announcements','announcement_id'],
    ['meetings','clubs','club_id'],
    ['meeting_action_items','meetings','meeting_id'],
    ['media','clubs','club_id'],
    ['expenses','clubs','club_id'],
    ['document_uploads','teams','team_id'],
    ['match_events','matches','match_id'],
    ['live_embeds','matches','match_id']
  ];
  t text;
  n int;
begin
  foreach t in array all_tables loop
    execute format(
      'alter table public.%I add column if not exists org_id uuid references public.organizations(id) on delete cascade', t);
    execute format(
      'create index if not exists %I on public.%I (org_id)', t || '_org_id_idx', t);
  end loop;

  for n in 1 .. array_length(parents, 1) loop
    execute format('drop trigger if exists fill_org_id on public.%I', parents[n][1]);
    execute format(
      'create trigger fill_org_id before insert on public.%I
         for each row execute function public.fill_org_id_from_parent(%L, %L)',
      parents[n][1], parents[n][2], parents[n][3]);
  end loop;

  foreach t in array all_tables loop
    execute format('alter table public.%I alter column org_id set not null', t);
  end loop;
end $mig$;;