'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser, isPlatformAdmin } from '@/lib/supabase/server';

// Fixed, well-known slug so "wipe" can always find exactly what "load"
// created, across sessions, without tracking ids anywhere -- no hidden
// state, just look up 'dula-demo' and cascade from there.
const DEMO_ORG_SLUG = 'dula-demo';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

/**
 * Seeds one demo org -> club -> 2 teams -> 10 players -> a handful of
 * guardians, so the roster/guardian UI has something to look at without
 * needing to hand-type data first. Runs as the signed-in platform admin
 * through the normal RLS-respecting client (not service role) -- every
 * insert below relies on the platform-admin bypass already on
 * organizations/clubs/club_staff/teams/players/guardians/player_guardians,
 * so this only works when the signed-in user actually is one.
 */
export async function loadDemoData() {
  if (!(await isPlatformAdmin())) return { error: 'Only a platform admin can load demo data.' };

  const dulaUser = await getCurrentDulaUser();
  if (!dulaUser) return { error: 'Not signed in.' };

  const supabase = await createClient();

  const { data: existingOrg } = await supabase.from('organizations').select('id').eq('slug', DEMO_ORG_SLUG).maybeSingle();
  if (existingOrg) return { error: 'Demo data is already loaded. Wipe it first to reload.' };

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ slug: DEMO_ORG_SLUG, name: 'Riverside Youth Sports Club (Demo)' })
    .select()
    .single();
  if (orgError) return { error: friendlyError(orgError) };

  // clubs' insert RLS is org_has_product(org_id,'club') AND is_org_admin --
  // a brand-new org has no entitlement row yet, so without this the very
  // next insert is refused (§5).
  const { error: entitlementError } = await supabase.from('org_entitlements').insert({ org_id: org.id, product: 'club' });
  if (entitlementError) return { error: friendlyError(entitlementError) };

  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .insert({ name: 'Riverside FC (Demo)', org_id: org.id, slug: 'riverside-fc-demo' })
    .select()
    .single();
  if (clubError) return { error: friendlyError(clubError) };

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .insert([
      { name: 'Riverside U12 (Demo)', category_id: crypto.randomUUID(), club_id: club.id, slug: 'u12' },
      { name: 'Riverside U15 (Demo)', category_id: crypto.randomUUID(), club_id: club.id, slug: 'u15' },
    ])
    .select();
  if (teamsError) return { error: friendlyError(teamsError) };
  const [u12, u15] = teams;

  // Demo staff used to be a separate placeholder public.users row
  // (Coach Dela Cruz) inserted directly. public.users has no INSERT
  // policy at all now (phase1_identity_on_auth_uid) -- a profile row can
  // only be created by the signup trigger, tied to a real auth.users
  // account -- so a client-side insert of a fabricated user is no longer
  // possible. The signed-in platform admin plays the coach role for the
  // demo instead of a fictional second account.
  const demoStaffUser = dulaUser;

  const { error: clubStaffError } = await supabase
    .from('club_staff')
    .insert({ club_id: club.id, user_id: demoStaffUser.id, role: 'coach' });
  if (clubStaffError) return { error: friendlyError(clubStaffError) };

  // As of the RBAC narrowing (2026-08-29), a coach without a team
  // assignment has no access to anything -- assign the demo coach to
  // U12 so the demo actually demonstrates the coach role, not a locked-out one.
  const { error: assignError } = await supabase
    .from('user_assigned_teams')
    .insert({ user_id: demoStaffUser.id, team_id: u12.id });
  if (assignError) return { error: friendlyError(assignError) };

  const u12Players = [
    { name: 'Mateo Santos', jersey: '7', position: 'Forward', age: '11' },
    { name: 'Liam Cruz', jersey: '4', position: 'Defender', age: '12' },
    { name: 'Noah Reyes', jersey: '1', position: 'Goalkeeper', age: '12' },
    { name: 'Ethan Bautista', jersey: '10', position: 'Midfielder', age: '11' },
    { name: 'Gabriel Torres', jersey: '9', position: 'Forward', age: '12' },
  ].map((p) => ({ ...p, team_id: u12.id }));

  const u15Players = [
    { name: 'Sofia Garcia', jersey: '8', position: 'Midfielder', age: '15' },
    { name: 'Isabella Ramos', jersey: '3', position: 'Defender', age: '14' },
    { name: 'Mia Fernandez', jersey: '1', position: 'Goalkeeper', age: '15' },
    { name: 'Ava Villanueva', jersey: '11', position: 'Forward', age: '14' },
    { name: 'Emma Castillo', jersey: '6', position: 'Midfielder', age: '15' },
  ].map((p) => ({ ...p, team_id: u15.id }));

  const { data: players, error: playersError } = await supabase
    .from('players')
    .insert([...u12Players, ...u15Players])
    .select();
  if (playersError) return { error: friendlyError(playersError) };

  // Guardians for a few players only, deliberately -- shows both the
  // "has guardians" and "no guardians yet" states in the same demo.
  const guardianSeeds = [
    { player: players[0], name: 'Carlos Santos', relationship: 'parent', phone: '0917-555-0101' },
    { player: players[1], name: 'Grace Cruz', relationship: 'parent', phone: '0917-555-0102' },
    { player: players[5], name: 'Renato Garcia', relationship: 'parent', phone: '0917-555-0103', email: 'renato.garcia@demo.local' },
    // Left in the "invited" state on purpose -- demonstrates the club
    // dashboard's "pending guardian invites" rollup, not just the
    // has-guardians / no-guardians-yet states the other three cover.
    { player: players[7], name: 'Dela Ramos', relationship: 'legal_guardian', phone: '0917-555-0104', email: 'dela.ramos@demo.local', accountStatus: 'invited' as const },
  ];

  for (const seed of guardianSeeds) {
    const { data: guardian, error: guardianError } = await supabase
      .from('guardians')
      .insert({
        name: seed.name,
        org_id: org.id,
        created_by: dulaUser.id,
        contact_info: { phone: seed.phone ?? null, email: (seed as any).email ?? null },
        account_status: (seed as any).accountStatus ?? 'no_account',
        invited_at: (seed as any).accountStatus === 'invited' ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (guardianError) return { error: friendlyError(guardianError) };

    const { error: linkError } = await supabase
      .from('player_guardians')
      .insert({ player_id: seed.player.id, guardian_id: guardian.id, relationship: seed.relationship });
    if (linkError) return { error: friendlyError(linkError) };
  }

  // --- Coach module: drills, sessions, attendance, evaluations, goals, notes ---
  // Everything below is scoped by club_id (drills/evaluations/goals/notes)
  // or cascades from a club_id-scoped row (session_drills from
  // training_sessions, skill ratings from evaluations, goal_drills from
  // goals) -- so wipeDemoData() doesn't need any new cleanup, deleting the
  // demo club at the end already cascades all of it away.
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const daysAgo = (n: number) => new Date(now - n * day);
  const daysFromNow = (n: number) => new Date(now + n * day);
  const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

  const { data: drills, error: drillsError } = await supabase
    .from('drills')
    .insert([
      { club_id: club.id, name: 'Rondo 4v1', category: 'technical', theme: 'Possession', duration_minutes: 15, difficulty: 'intermediate', player_min: 5, player_max: 5, objective: 'Keep possession under pressure', coaching_points: 'Quick first touch, scan before receiving', skills: ['First Touch', 'Awareness'], created_by: demoStaffUser.id },
      { club_id: club.id, name: 'Receive + Turn Under Pressure', category: 'technical', theme: 'Receiving', duration_minutes: 12, difficulty: 'intermediate', player_min: 4, player_max: 8, objective: 'Receive on the half-turn under pressure', coaching_points: 'Open body shape, check shoulder before receiving', skills: ['First Touch', 'Receiving', 'Awareness'], created_by: demoStaffUser.id },
      { club_id: club.id, name: 'Third Player Combination', category: 'tactical', theme: 'Possession', duration_minutes: 15, difficulty: 'advanced', player_min: 6, player_max: 12, objective: 'Use a third player to break pressure', coaching_points: 'Movement off the ball, timing of the run', skills: ['Decision Making', 'Movement Off Ball'], created_by: demoStaffUser.id },
      { club_id: club.id, name: '6v6 Positional Game', category: 'tactical', theme: 'Possession', duration_minutes: 20, difficulty: 'intermediate', player_min: 12, player_max: 14, objective: 'Apply possession principles in a game context', coaching_points: 'Width and depth, quick decisions', skills: ['Positioning', 'Decision Making'], created_by: demoStaffUser.id },
      { club_id: club.id, name: 'Weak Foot Rondo', category: 'technical', theme: 'Passing', duration_minutes: 10, difficulty: 'beginner', player_min: 5, player_max: 6, objective: 'Build comfort passing with the weaker foot', coaching_points: 'Plant foot position, follow through', skills: ['Weak Foot', 'Passing'], created_by: demoStaffUser.id },
      { club_id: club.id, name: '1v1 to Small Goals', category: 'technical', theme: 'Finishing', duration_minutes: 12, difficulty: 'intermediate', player_min: 2, player_max: 8, objective: 'Beat a defender and finish', coaching_points: 'Change of pace, composure on the shot', skills: ['Dribbling', 'Finishing'], created_by: demoStaffUser.id },
    ])
    .select();
  if (drillsError) return { error: friendlyError(drillsError) };

  const { data: sessions, error: sessionsError } = await supabase
    .from('training_sessions')
    .insert([
      { club_id: club.id, team_id: u12.id, starts_at: daysAgo(14).toISOString(), ends_at: new Date(daysAgo(14).getTime() + 60 * 60_000).toISOString(), status: 'completed', theme: 'Receiving', objective: 'Improve first touch under pressure', notes: 'Good energy today', coach_id: demoStaffUser.id, created_by: demoStaffUser.id },
      { club_id: club.id, team_id: u12.id, starts_at: daysAgo(7).toISOString(), ends_at: new Date(daysAgo(7).getTime() + 60 * 60_000).toISOString(), status: 'completed', theme: 'Passing', objective: 'Build weak-foot comfort', coach_id: demoStaffUser.id, created_by: demoStaffUser.id },
      { club_id: club.id, team_id: u12.id, starts_at: daysAgo(3).toISOString(), ends_at: new Date(daysAgo(3).getTime() + 75 * 60_000).toISOString(), status: 'completed', theme: 'Possession', objective: 'Playing through pressure', coach_id: demoStaffUser.id, created_by: demoStaffUser.id },
      { club_id: club.id, team_id: u12.id, starts_at: daysFromNow(4).toISOString(), ends_at: new Date(daysFromNow(4).getTime() + 60 * 60_000).toISOString(), status: 'scheduled', theme: 'Finishing', objective: 'Composure in front of goal', coach_id: demoStaffUser.id, created_by: demoStaffUser.id },
    ])
    .select();
  if (sessionsError) return { error: friendlyError(sessionsError) };

  const pastSessions = sessions.filter((s) => s.status === 'completed');
  const u12Roster = players.slice(0, 5);
  const attendancePattern: Record<number, string[]> = {
    0: ['present', 'present', 'present'],
    1: ['present', 'late', 'present'],
    2: ['present', 'present', 'absent'],
    3: ['late', 'present', 'present'],
    4: ['absent', 'present', 'present'],
  };
  const attendanceRows = u12Roster.flatMap((p, i) =>
    pastSessions.map((s, j) => ({
      training_session_id: s.id,
      player_id: p.id,
      status: attendancePattern[i][j],
      created_by: demoStaffUser.id,
    }))
  );
  const { error: attendanceError } = await supabase.from('attendance').insert(attendanceRows);
  if (attendanceError) return { error: friendlyError(attendanceError) };

  const { error: sessionDrillsError } = await supabase.from('session_drills').insert([
    { session_id: pastSessions[0].id, drill_id: drills[1].id, sort_order: 1 },
    { session_id: pastSessions[0].id, drill_id: drills[0].id, sort_order: 2 },
    { session_id: pastSessions[2].id, drill_id: drills[2].id, sort_order: 1 },
    { session_id: pastSessions[2].id, drill_id: drills[3].id, sort_order: 2 },
  ]);
  if (sessionDrillsError) return { error: friendlyError(sessionDrillsError) };

  const { data: skillRows } = await supabase.from('development_skills').select('id, name');
  const skillId = (name: string) => skillRows?.find((s) => s.name === name)?.id ?? null;

  const { data: evaluations, error: evaluationsError } = await supabase
    .from('player_evaluations')
    .insert([
      { player_id: players[0].id, team_id: u12.id, club_id: club.id, coach_id: demoStaffUser.id, evaluation_date: dateOnly(daysAgo(60)), period: 'Preseason', technical_score: 2.5, tactical_score: 2.5, physical_score: 3, mental_score: 3, strengths: 'Good work rate', development_areas: 'First touch under pressure', coach_comments: 'Solid start to preseason.', visibility: 'coach_only', created_by: demoStaffUser.id },
      { player_id: players[0].id, team_id: u12.id, club_id: club.id, coach_id: demoStaffUser.id, evaluation_date: dateOnly(daysAgo(5)), period: 'Fall check-in', technical_score: 3.5, tactical_score: 3, physical_score: 3, mental_score: 4, strengths: 'Ball carrying, work rate', development_areas: 'Weak-foot passing', coach_comments: 'Great improvement receiving under pressure — keep scanning before you receive.', visibility: 'player_and_parent', created_by: demoStaffUser.id },
      { player_id: players[1].id, team_id: u12.id, club_id: club.id, coach_id: demoStaffUser.id, evaluation_date: dateOnly(daysAgo(5)), period: 'Fall check-in', technical_score: 3, tactical_score: 3, physical_score: 3.5, mental_score: 3, strengths: 'Positioning', development_areas: 'Distribution under pressure', coach_comments: 'Steady defensively.', visibility: 'staff', created_by: demoStaffUser.id },
    ])
    .select();
  if (evaluationsError) return { error: friendlyError(evaluationsError) };

  const ratingRows: { evaluation_id: string; skill_id: string; rating: number }[] = [];
  const addRatings = (evaluationId: string, ratings: Record<string, number>) => {
    for (const [name, rating] of Object.entries(ratings)) {
      const sid = skillId(name);
      if (sid) ratingRows.push({ evaluation_id: evaluationId, skill_id: sid, rating });
    }
  };
  addRatings(evaluations[0].id, { 'First Touch': 2, Passing: 3, Awareness: 2 });
  addRatings(evaluations[1].id, { 'First Touch': 4, Passing: 3, 'Weak Foot': 2, Awareness: 4 });
  addRatings(evaluations[2].id, { Positioning: 3, 'Decision Making': 3, Passing: 3 });
  if (ratingRows.length) {
    const { error: ratingsError } = await supabase.from('player_skill_ratings').insert(ratingRows);
    if (ratingsError) return { error: friendlyError(ratingsError) };
  }

  const { error: goalsError } = await supabase.from('development_goals').insert([
    { player_id: players[0].id, team_id: u12.id, club_id: club.id, skill_id: skillId('Weak Foot'), title: 'Improve weak-foot passing', description: 'Build comfort and accuracy passing with the left foot.', starting_level: 2, target_level: 4, current_level: 3, start_date: dateOnly(daysAgo(30)), target_date: dateOnly(daysFromNow(60)), status: 'in_progress', success_criteria: 'Complete 8/10 short passes using the left foot under moderate pressure.', visibility: 'player_and_parent', created_by: demoStaffUser.id },
    { player_id: players[0].id, team_id: u12.id, club_id: club.id, skill_id: skillId('Receiving'), title: 'Improve receiving under pressure', starting_level: 2, target_level: 4, current_level: 4, start_date: dateOnly(daysAgo(70)), target_date: dateOnly(daysAgo(2)), status: 'achieved', success_criteria: 'Receive and turn cleanly in a 1v1 under pressure 7/10 times.', visibility: 'player_and_parent', created_by: demoStaffUser.id },
    { player_id: players[1].id, team_id: u12.id, club_id: club.id, skill_id: skillId('Finishing'), title: 'Improve finishing composure', starting_level: 2, target_level: 3, current_level: 2, start_date: dateOnly(daysAgo(20)), target_date: dateOnly(daysFromNow(40)), status: 'needs_attention', success_criteria: 'Convert 4/10 one-on-one finishing reps.', visibility: 'coach_only', created_by: demoStaffUser.id },
  ]);
  if (goalsError) return { error: friendlyError(goalsError) };

  const { error: notesError } = await supabase.from('player_development_notes').insert([
    { player_id: players[0].id, team_id: u12.id, club_id: club.id, note: 'Better scanning before receiving today — noticeable improvement.', visibility: 'player_and_parent', created_by: demoStaffUser.id },
    { player_id: players[0].id, team_id: u12.id, club_id: club.id, note: 'Still rushing the first touch when tired late in sessions.', visibility: 'coach_only', created_by: demoStaffUser.id },
    { player_id: players[1].id, team_id: u12.id, club_id: club.id, note: 'Good communication organizing the back line.', visibility: 'parent', created_by: demoStaffUser.id },
  ]);
  if (notesError) return { error: friendlyError(notesError) };

  // --- Club Manager module: fees, trips, announcements ---
  // status is never set to something payments would contradict (§5) --
  // recompute_fee_status only runs on a payments change, so a brand-new
  // charge's initial value has to match what that function would derive
  // for zero payments itself: 'overdue' if due_date is already past,
  // otherwise 'pending'. Player 0's charge below gets flipped to 'paid'
  // by an actual payment row, not by being inserted that way.
  const { data: feeCharges, error: feesError } = await supabase
    .from('fee_charges')
    .insert([
      { club_id: club.id, player_id: players[0].id, fee_type: 'membership', amount: 2500, currency: 'PHP', status: 'pending', due_date: dateOnly(daysAgo(20)), created_by: demoStaffUser.id },
      { club_id: club.id, player_id: players[1].id, fee_type: 'membership', amount: 2500, currency: 'PHP', status: 'pending', due_date: dateOnly(daysFromNow(10)), created_by: demoStaffUser.id },
      { club_id: club.id, player_id: players[5].id, fee_type: 'uniform', amount: 850, currency: 'PHP', status: 'overdue', due_date: dateOnly(daysAgo(5)), created_by: demoStaffUser.id },
    ])
    .select();
  if (feesError) return { error: friendlyError(feesError) };

  const { error: paymentError } = await supabase
    .from('payments')
    .insert({ fee_charge_id: feeCharges[0].id, amount: 2500, method: 'gcash', created_by: demoStaffUser.id });
  if (paymentError) return { error: friendlyError(paymentError) };

  const paidCharge = feeCharges.find((f) => f.status === 'paid');
  if (paidCharge) {
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({ fee_charge_id: paidCharge.id, amount: paidCharge.amount, method: 'card', created_by: demoStaffUser.id });
    if (paymentError) return { error: friendlyError(paymentError) };
  }

  const { error: tripsError } = await supabase.from('trips').insert([
    { club_id: club.id, name: 'Regional Showcase', purpose: 'tournament', starts_at: daysFromNow(21).toISOString(), ends_at: daysFromNow(23).toISOString(), created_by: demoStaffUser.id },
  ]);
  if (tripsError) return { error: friendlyError(tripsError) };

  const { error: announcementsError } = await supabase.from('announcements').insert([
    { club_id: club.id, title: 'Welcome to the Fall season', body: 'Practice schedules are posted -- check your team page for details.', audience: 'club', pinned: true, created_by: demoStaffUser.id },
    { club_id: club.id, team_id: u12.id, title: 'U12 kit reminder', body: 'Please bring both light and dark jerseys to Saturday’s session.', audience: 'team', pinned: false, created_by: demoStaffUser.id },
  ]);
  if (announcementsError) return { error: friendlyError(announcementsError) };

  revalidatePath('/clubs');
  return { success: true, clubSlug: club.slug };
}

/**
 * Deletes everything loadDemoData created, in dependency order rather
 * than relying on FK cascade behavior (teams.club_id is ON DELETE SET
 * NULL, not CASCADE -- relying on cascade here would leave orphaned demo
 * teams sitting in the unclaimed-teams picker for every real club).
 * Looks everything up fresh by DEMO_ORG_SLUG rather than tracking ids
 * anywhere, so it works even in a fresh session.
 */
export async function wipeDemoData() {
  if (!(await isPlatformAdmin())) return { error: 'Only a platform admin can wipe demo data.' };

  const supabase = await createClient();

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', DEMO_ORG_SLUG).maybeSingle();
  if (!org) return { error: 'No demo data found.' };

  const { data: clubs } = await supabase.from('clubs').select('id').eq('org_id', org.id);
  const clubIds = (clubs ?? []).map((c) => c.id);

  const { data: teams } = clubIds.length
    ? await supabase.from('teams').select('id').in('club_id', clubIds)
    : { data: [] };
  const teamIds = (teams ?? []).map((t) => t.id);

  const { data: players } = teamIds.length
    ? await supabase.from('players').select('id').in('team_id', teamIds)
    : { data: [] };
  const playerIds = (players ?? []).map((p) => p.id);

  if (playerIds.length) {
    const { data: links } = await supabase.from('player_guardians').select('guardian_id').in('player_id', playerIds);
    const guardianIds = [...new Set((links ?? []).map((l) => l.guardian_id))];

    await supabase.from('player_guardians').delete().in('player_id', playerIds);
    if (guardianIds.length) await supabase.from('guardians').delete().in('id', guardianIds);
    await supabase.from('players').delete().in('id', playerIds);
  }

  // No demo-only public.users row to clean up here: the "coach" is the
  // signed-in platform admin's own real account (see loadDemoData), not
  // a fabricated one, so deleting it is never on the table.
  if (clubIds.length) await supabase.from('club_staff').delete().in('club_id', clubIds);
  if (teamIds.length) await supabase.from('user_assigned_teams').delete().in('team_id', teamIds);

  if (teamIds.length) await supabase.from('teams').delete().in('id', teamIds);
  if (clubIds.length) await supabase.from('clubs').delete().in('id', clubIds);
  await supabase.from('organizations').delete().eq('id', org.id);

  revalidatePath('/clubs');
  return { success: true };
}
