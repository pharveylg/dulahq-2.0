-- Phase 2e: every policy now opens with the org fence.
-- Policies are OR'd, so the fence is carried inside each one rather than sitting
-- in a separate permissive policy that would widen access instead of narrowing it.

create or replace function public.can_read_club(p_org uuid, p_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_member(p_org)
     and (public.is_club_staff(p_club) or public.is_org_admin(p_org));
$$;

create or replace function public.can_admin_club(p_org uuid, p_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_member(p_org)
     and (public.is_club_admin(p_club) or public.is_org_admin(p_org));
$$;

-- Drop every existing policy on the tables being re-governed.
do $mig$
declare
  targets constant text[] := array[
    'clubs','teams','club_staff','team_staff','user_assigned_teams','players',
    'guardians','player_guardians','attendance','training_sessions','session_drills',
    'drills','player_evaluations','player_skill_ratings','development_goals',
    'development_goal_drills','player_development_notes','development_skills',
    'fee_charges','payments','memberships','membership_export_requests','trips',
    'trip_passengers','trip_transportation','announcements','announcement_reads',
    'meetings','meeting_action_items','media','expenses','document_uploads',
    'tournaments','matches','match_events','registrations','referees',
    'officiating_team','live_embeds','access_requests','organizations','org_members','users'
  ];
  t text; p record;
begin
  foreach t in array targets loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $mig$;

-- ---------- identity and tenancy ----------
create policy users_read_self_and_org on public.users for select to authenticated
  using (id = auth.uid()
         or public.is_platform_admin()
         or exists (select 1 from public.role_assignments ra
                    where ra.user_id = public.users.id
                      and ra.org_id in (select public.current_user_org_ids())));
create policy users_update_self on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy orgs_public_read on public.organizations for select to anon, authenticated
  using (status = 'active');
create policy orgs_admin_write on public.organizations for all to authenticated
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy orgs_create on public.organizations for insert to authenticated
  with check (auth.uid() is not null);

create policy org_members_read on public.org_members for select to authenticated
  using (public.is_org_member(org_id));
create policy org_members_write on public.org_members for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- ---------- clubs and squads ----------
create policy clubs_member_read on public.clubs for select to authenticated
  using (public.is_org_member(org_id));
create policy clubs_admin_write on public.clubs for all to authenticated
  using (public.can_admin_club(org_id, id))
  with check (public.is_org_admin(org_id) and public.org_has_product(org_id,'club'));

create policy teams_read on public.teams for select to authenticated
  using (public.is_org_member(org_id));
create policy teams_write on public.teams for all to authenticated
  using (public.can_admin_club(org_id, club_id))
  with check (public.can_admin_club(org_id, club_id));

create policy club_staff_read on public.club_staff for select to authenticated
  using (public.can_read_club(org_id, club_id) or user_id = auth.uid());
create policy club_staff_write on public.club_staff for all to authenticated
  using (public.can_admin_club(org_id, club_id))
  with check (public.can_admin_club(org_id, club_id));

create policy team_staff_read on public.team_staff for select to authenticated
  using (public.is_org_member(org_id));
create policy team_staff_write on public.team_staff for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy uat_read on public.user_assigned_teams for select to authenticated
  using (public.is_org_member(org_id) or user_id = auth.uid());
create policy uat_write on public.user_assigned_teams for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- ---------- people: staff, the assigned coach, the family, the player ----------
create policy players_read on public.players for select to authenticated
  using (public.is_org_member(org_id) and (
           public.is_assigned_to_team(team_id)
           or exists (select 1 from public.teams t
                      where t.id = players.team_id and public.can_read_club(players.org_id, t.club_id))
           or public.is_guardian_of(id)
           or user_id = auth.uid()));
create policy players_write on public.players for all to authenticated
  using (public.is_org_member(org_id) and (
           public.is_assigned_to_team(team_id)
           or exists (select 1 from public.teams t
                      where t.id = players.team_id and public.can_admin_club(players.org_id, t.club_id))))
  with check (public.is_org_member(org_id));

create policy guardians_read on public.guardians for select to authenticated
  using (public.is_org_member(org_id) and (
           user_id = auth.uid()
           or exists (select 1 from public.player_guardians pg
                      join public.players p on p.id = pg.player_id
                      join public.teams t on t.id = p.team_id
                      where pg.guardian_id = guardians.id
                        and public.can_read_club(guardians.org_id, t.club_id))));
create policy guardians_self_update on public.guardians for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy guardians_staff_write on public.guardians for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_member(org_id));

create policy pg_read on public.player_guardians for select to authenticated
  using (public.is_org_member(org_id) and (
           public.is_guardian_of(player_id)
           or public.is_player_self(player_id)
           or exists (select 1 from public.players p join public.teams t on t.id = p.team_id
                      where p.id = player_guardians.player_id
                        and public.can_read_club(player_guardians.org_id, t.club_id))));
create policy pg_write on public.player_guardians for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_member(org_id));

-- ---------- training ----------
create policy sessions_read on public.training_sessions for select to authenticated
  using (public.is_org_member(org_id) and (
           public.can_read_club(org_id, club_id) or public.is_assigned_to_team(team_id)));
create policy sessions_write on public.training_sessions for all to authenticated
  using (public.is_org_member(org_id) and (
           public.can_admin_club(org_id, club_id) or public.is_assigned_to_team(team_id)))
  with check (public.is_org_member(org_id));

create policy session_drills_read on public.session_drills for select to authenticated
  using (public.is_org_member(org_id));
create policy session_drills_write on public.session_drills for all to authenticated
  using (public.is_org_member(org_id) and exists (
           select 1 from public.training_sessions s where s.id = session_drills.session_id
             and (public.can_admin_club(s.org_id, s.club_id) or public.is_assigned_to_team(s.team_id))))
  with check (public.is_org_member(org_id));

create policy drills_read on public.drills for select to authenticated
  using (public.is_org_member(org_id));
create policy drills_write on public.drills for all to authenticated
  using (public.can_admin_club(org_id, club_id) or public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy attendance_read on public.attendance for select to authenticated
  using (public.is_org_member(org_id) and (
           public.is_guardian_of(player_id) or public.is_player_self(player_id)
           or exists (select 1 from public.training_sessions s
                      where s.id = attendance.training_session_id
                        and (public.can_read_club(s.org_id, s.club_id)
                             or public.is_assigned_to_team(s.team_id)))));
create policy attendance_write on public.attendance for all to authenticated
  using (public.is_org_member(org_id) and exists (
           select 1 from public.training_sessions s where s.id = attendance.training_session_id
             and (public.can_admin_club(s.org_id, s.club_id) or public.is_assigned_to_team(s.team_id))))
  with check (public.is_org_member(org_id));

-- ---------- development: the visibility field is load-bearing ----------
create policy skills_read on public.development_skills for select to authenticated using (true);
create policy skills_write on public.development_skills for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy evals_read on public.player_evaluations for select to authenticated
  using (public.is_org_member(org_id) and (
           public.can_admin_club(org_id, club_id)
           or public.is_assigned_to_team(team_id)
           or (visibility in ('player_and_parent','parent') and public.is_guardian_of(player_id))
           or (visibility in ('player_and_parent') and public.is_player_self(player_id))
           or (visibility = 'staff' and public.can_read_club(org_id, club_id))));
create policy evals_write on public.player_evaluations for all to authenticated
  using (public.is_org_member(org_id) and (
           public.can_admin_club(org_id, club_id) or public.is_assigned_to_team(team_id)))
  with check (public.is_org_member(org_id));

create policy ratings_read on public.player_skill_ratings for select to authenticated
  using (public.is_org_member(org_id) and exists (
           select 1 from public.player_evaluations e where e.id = player_skill_ratings.evaluation_id));
create policy ratings_write on public.player_skill_ratings for all to authenticated
  using (public.is_org_member(org_id) and exists (
           select 1 from public.player_evaluations e where e.id = player_skill_ratings.evaluation_id
             and (public.can_admin_club(e.org_id, e.club_id) or public.is_assigned_to_team(e.team_id))))
  with check (public.is_org_member(org_id));

create policy goals_read on public.development_goals for select to authenticated
  using (public.is_org_member(org_id) and (
           public.can_admin_club(org_id, club_id)
           or public.is_assigned_to_team(team_id)
           or (visibility in ('player_and_parent','parent') and public.is_guardian_of(player_id))
           or (visibility = 'player_and_parent' and public.is_player_self(player_id))));
create policy goals_write on public.development_goals for all to authenticated
  using (public.is_org_member(org_id) and (
           public.can_admin_club(org_id, club_id) or public.is_assigned_to_team(team_id)))
  with check (public.is_org_member(org_id));

create policy goal_drills_read on public.development_goal_drills for select to authenticated
  using (public.is_org_member(org_id));
create policy goal_drills_write on public.development_goal_drills for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy notes_read on public.player_development_notes for select to authenticated
  using (public.is_org_member(org_id) and (
           public.can_admin_club(org_id, club_id)
           or public.is_assigned_to_team(team_id)
           or (visibility in ('player_and_parent','parent') and public.is_guardian_of(player_id))
           or (visibility = 'player_and_parent' and public.is_player_self(player_id))));
create policy notes_write on public.player_development_notes for all to authenticated
  using (public.is_org_member(org_id) and (
           public.can_admin_club(org_id, club_id) or public.is_assigned_to_team(team_id)))
  with check (public.is_org_member(org_id));

-- ---------- money: the treasurer path, and the family's own charges ----------
create policy fees_read on public.fee_charges for select to authenticated
  using (public.is_org_member(org_id) and (
           public.can_read_club(org_id, club_id)
           or public.is_guardian_of(player_id)
           or public.is_player_self(player_id)));
create policy fees_write on public.fee_charges for all to authenticated
  using (public.can_admin_club(org_id, club_id)) with check (public.can_admin_club(org_id, club_id));

create policy payments_read on public.payments for select to authenticated
  using (public.is_org_member(org_id) and exists (
           select 1 from public.fee_charges f where f.id = payments.fee_charge_id
             and (public.can_read_club(f.org_id, f.club_id)
                  or public.is_guardian_of(f.player_id) or public.is_player_self(f.player_id))));
create policy payments_write on public.payments for all to authenticated
  using (public.is_org_member(org_id) and exists (
           select 1 from public.fee_charges f where f.id = payments.fee_charge_id
             and public.can_admin_club(f.org_id, f.club_id)))
  with check (public.is_org_member(org_id));

create policy expenses_read on public.expenses for select to authenticated
  using (public.can_read_club(org_id, club_id));
create policy expenses_write on public.expenses for all to authenticated
  using (public.can_admin_club(org_id, club_id)) with check (public.can_admin_club(org_id, club_id));

-- ---------- membership, trips, comms, files ----------
create policy memberships_read on public.memberships for select to authenticated
  using (public.is_org_member(org_id) and (
           public.can_read_club(org_id, club_id) or public.is_guardian_of(player_id)
           or public.is_player_self(player_id)));
create policy memberships_write on public.memberships for all to authenticated
  using (public.can_admin_club(org_id, club_id)) with check (public.can_admin_club(org_id, club_id));

create policy mer_read on public.membership_export_requests for select to authenticated
  using (public.can_read_club(org_id, club_id));
create policy mer_write on public.membership_export_requests for all to authenticated
  using (public.can_admin_club(org_id, club_id)) with check (public.is_org_member(org_id));

create policy trips_read on public.trips for select to authenticated
  using (public.is_org_member(org_id));
create policy trips_write on public.trips for all to authenticated
  using (public.can_admin_club(org_id, club_id)) with check (public.can_admin_club(org_id, club_id));

create policy trip_pax_read on public.trip_passengers for select to authenticated
  using (public.is_org_member(org_id));
create policy trip_pax_write on public.trip_passengers for all to authenticated
  using (public.is_org_member(org_id) and exists (
           select 1 from public.trips tr where tr.id = trip_passengers.trip_id
             and public.can_admin_club(tr.org_id, tr.club_id)))
  with check (public.is_org_member(org_id));

create policy trip_tr_read on public.trip_transportation for select to authenticated
  using (public.is_org_member(org_id));
create policy trip_tr_write on public.trip_transportation for all to authenticated
  using (public.is_org_member(org_id) and exists (
           select 1 from public.trips tr where tr.id = trip_transportation.trip_id
             and public.can_admin_club(tr.org_id, tr.club_id)))
  with check (public.is_org_member(org_id));

create policy ann_read on public.announcements for select to authenticated
  using (public.is_org_member(org_id));
create policy ann_write on public.announcements for all to authenticated
  using (public.can_admin_club(org_id, club_id) or public.is_assigned_to_team(team_id))
  with check (public.is_org_member(org_id));

create policy ann_reads_read on public.announcement_reads for select to authenticated
  using (public.is_org_member(org_id) and user_id = auth.uid());
create policy ann_reads_write on public.announcement_reads for insert to authenticated
  with check (public.is_org_member(org_id) and user_id = auth.uid());

create policy meetings_read on public.meetings for select to authenticated
  using (public.can_read_club(org_id, club_id));
create policy meetings_write on public.meetings for all to authenticated
  using (public.can_admin_club(org_id, club_id)) with check (public.can_admin_club(org_id, club_id));

create policy mai_read on public.meeting_action_items for select to authenticated
  using (public.is_org_member(org_id) and (assigned_to = auth.uid() or exists (
           select 1 from public.meetings m where m.id = meeting_action_items.meeting_id
             and public.can_read_club(m.org_id, m.club_id))));
create policy mai_write on public.meeting_action_items for all to authenticated
  using (public.is_org_member(org_id) and exists (
           select 1 from public.meetings m where m.id = meeting_action_items.meeting_id
             and public.can_admin_club(m.org_id, m.club_id)))
  with check (public.is_org_member(org_id));

create policy media_read on public.media for select to authenticated
  using (public.is_org_member(org_id));
create policy media_write on public.media for all to authenticated
  using (public.can_admin_club(org_id, club_id)) with check (public.is_org_member(org_id));

create policy docs_read on public.document_uploads for select to authenticated
  using (public.is_org_member(org_id) and (
           public.is_guardian_of(player_id) or public.is_player_self(player_id)
           or exists (select 1 from public.teams t where t.id = document_uploads.team_id
                      and public.can_read_club(document_uploads.org_id, t.club_id))));
create policy docs_write on public.document_uploads for all to authenticated
  using (public.is_org_member(org_id) and exists (
           select 1 from public.teams t where t.id = document_uploads.team_id
             and public.can_admin_club(document_uploads.org_id, t.club_id)))
  with check (public.is_org_member(org_id));

-- ---------- tournament side (rebuilt properly in phase 5) ----------
create policy tournaments_member_read on public.tournaments for select to authenticated
  using (public.is_org_member(org_id));
create policy tournaments_write on public.tournaments for all to authenticated
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id) and public.org_has_product(org_id,'tournament'));

create policy matches_public_read on public.matches for select to anon, authenticated
  using (exists (select 1 from public.tournaments t
                 where t.org_id = matches.org_id and t.publicly_listed = true));
create policy matches_member_read on public.matches for select to authenticated
  using (public.is_org_member(org_id));
create policy matches_write on public.matches for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy events_member_read on public.match_events for select to authenticated
  using (public.is_org_member(org_id));
create policy events_write on public.match_events for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy regs_read on public.registrations for select to authenticated
  using (public.is_org_member(org_id));
create policy regs_public_insert on public.registrations for insert to anon, authenticated
  with check (org_id is not null);
create policy regs_write on public.registrations for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy referees_read on public.referees for select to authenticated
  using (public.is_org_member(org_id));
create policy referees_write on public.referees for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy offteam_read on public.officiating_team for select to authenticated
  using (public.is_org_member(org_id));
create policy offteam_write on public.officiating_team for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy embeds_read on public.live_embeds for select to authenticated
  using (public.is_org_member(org_id));
create policy embeds_write on public.live_embeds for all to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- Public request-to-join stays public to insert, private to read.
create policy ar_public_insert on public.access_requests for insert to anon, authenticated
  with check (org_id is not null);
create policy ar_read on public.access_requests for select to authenticated
  using (public.is_org_admin(org_id) or requested_by = auth.uid());
create policy ar_decide on public.access_requests for update to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));;