'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser, isPlatformAdmin } from '@/lib/supabase/server';

// Fixed, well-known slug so "wipe" can always find exactly what "load"
// created, across sessions, without tracking ids anywhere -- no hidden
// state, just look up 'dula-demo' and cascade from there.
const DEMO_ORG_SLUG = 'dula-demo';
const DEMO_STAFF_EMAIL = 'coach.delacruz@demo.dulahq.local';

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

  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .insert({ name: 'Riverside FC (Demo)', org_id: org.id })
    .select()
    .single();
  if (clubError) return { error: friendlyError(clubError) };

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .insert([
      { name: 'Riverside U12 (Demo)', category_id: crypto.randomUUID(), club_id: club.id },
      { name: 'Riverside U15 (Demo)', category_id: crypto.randomUUID(), club_id: club.id },
    ])
    .select();
  if (teamsError) return { error: friendlyError(teamsError) };
  const [u12, u15] = teams;

  const { data: demoStaffUser, error: staffUserError } = await supabase
    .from('users')
    .insert({ email: DEMO_STAFF_EMAIL, name: 'Coach Dela Cruz (Demo)', role: 'audience' })
    .select()
    .single();
  if (staffUserError) return { error: friendlyError(staffUserError) };

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
    { player: players[7], name: 'Dela Ramos', relationship: 'legal_guardian', phone: '0917-555-0104' },
  ];

  for (const seed of guardianSeeds) {
    const { data: guardian, error: guardianError } = await supabase
      .from('guardians')
      .insert({
        name: seed.name,
        created_by: dulaUser.id,
        contact_info: { phone: seed.phone ?? null, email: (seed as any).email ?? null },
      })
      .select()
      .single();
    if (guardianError) return { error: friendlyError(guardianError) };

    const { error: linkError } = await supabase
      .from('player_guardians')
      .insert({ player_id: seed.player.id, guardian_id: guardian.id, relationship: seed.relationship });
    if (linkError) return { error: friendlyError(linkError) };
  }

  revalidatePath('/clubs');
  return { success: true, clubId: club.id };
}

/**
 * Deletes everything loadDemoData created, in dependency order rather
 * than relying on FK cascade behavior (teams.club_id is ON DELETE SET
 * NULL, not CASCADE -- relying on cascade here would leave orphaned demo
 * teams sitting in the unclaimed-teams picker for every real club).
 * Looks everything up fresh by DEMO_ORG_SLUG / DEMO_STAFF_EMAIL rather
 * than tracking ids anywhere, so it works even in a fresh session.
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

  if (clubIds.length) await supabase.from('club_staff').delete().in('club_id', clubIds);
  if (teamIds.length) await supabase.from('user_assigned_teams').delete().in('team_id', teamIds);
  await supabase.from('users').delete().eq('email', DEMO_STAFF_EMAIL);

  if (teamIds.length) await supabase.from('teams').delete().in('id', teamIds);
  if (clubIds.length) await supabase.from('clubs').delete().in('id', clubIds);
  await supabase.from('organizations').delete().eq('id', org.id);

  revalidatePath('/clubs');
  return { success: true };
}
