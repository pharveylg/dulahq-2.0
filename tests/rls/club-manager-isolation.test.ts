/**
 * Club Manager RLS isolation tests -- rewritten against the REAL shared
 * Dula HQ schema (project zytyakbgwaegvftblkcn), not the earlier
 * tenant-based design. See docs/club-manager-design.md for the full
 * rationale.
 *
 * Key differences from the earlier version of this file:
 *   - No tenants/tenant_users -- this database has none.
 *   - Uses the EXISTING public.teams / public.players tables, not new
 *     ones.
 *   - Identity is resolved by matching auth.jwt() ->> 'email' against
 *     public.users.email (current_dula_user_id()) -- NOT auth.uid().
 *     Every test user therefore needs BOTH an auth.users row (via
 *     admin.createUser) AND a manually-inserted public.users row with
 *     the matching email -- there is no trigger connecting the two.
 *   - Team-level scoping (coach/team_manager) is enforced via the
 *     EXISTING public.user_assigned_teams table, not a new
 *     Club-Manager-only assignment table.
 *
 * Environment note: this suite is written to run against a Supabase
 * BRANCH of the real project, not a local Docker instance -- Docker
 * Desktop was found to be non-functional in this environment (see
 * docs/club-manager-design.md's "Testing strategy" section). Create a
 * branch via the Supabase MCP `create_branch` tool (or the dashboard)
 * and point SUPABASE_URL/keys at the branch, never at production.
 *
 * 2026-08-27: clubs.org_id is now NOT NULL (see "Tenant fencing fix" in
 * club-manager-design.md) -- fixtures below create two throwaway
 * organizations and assign clubA/clubB to them, and a new describe block
 * exercises the org-scoped RLS that migration added (clubs readable
 * within org / org admin can insert clubs / a different org can't).
 */
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

let orgA: { id: string };
let orgB: { id: string };
let clubA: { id: string };
let clubB: { id: string };
let categoryId: string; // teams.category_id is NOT NULL; needs a value, doesn't need to reference a real category for these tests
let teamA1: { id: string };
let teamA2: { id: string };
let teamB1: { id: string };
let playerA1: { id: string };
let playerA2: { id: string };
let playerB: { id: string };

let coachA1Client: ReturnType<typeof createClient>;
let clubAdminAClient: ReturnType<typeof createClient>;
let clubStaffBClient: ReturnType<typeof createClient>;
let guardianOfA1Client: ReturnType<typeof createClient>;
let orgAdminAClient: ReturnType<typeof createClient>;

/**
 * Creates BOTH the auth.users row and the matching public.users row --
 * required because this schema has no auth->public sync trigger.
 */
async function createTestUser(email: string, role: string) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: 'test-password-123!',
    email_confirm: true,
  });
  if (error) throw error;

  const { data: publicUser, error: publicUserError } = await adminClient
    .from('users')
    .insert({ email, role, name: email.split('@')[0] })
    .select()
    .single();
  if (publicUserError) throw publicUserError;

  return { authUser: data.user, publicUser };
}

async function signInAs(email: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: 'test-password-123!',
  });
  if (error) throw error;
  return client;
}

beforeAll(async () => {
  categoryId = crypto.randomUUID(); // teams.category_id has no FK in the live schema; any uuid satisfies NOT NULL

  const suffix = crypto.randomUUID().slice(0, 8);
  const { data: oA } = await adminClient
    .from('organizations')
    .insert({ slug: `rls-test-org-a-${suffix}`, name: 'RLS Test Org A' })
    .select()
    .single();
  orgA = oA;
  const { data: oB } = await adminClient
    .from('organizations')
    .insert({ slug: `rls-test-org-b-${suffix}`, name: 'RLS Test Org B' })
    .select()
    .single();
  orgB = oB;

  const { data: cA } = await adminClient.from('clubs').insert({ name: 'RLS Test Club A', org_id: orgA.id }).select().single();
  clubA = cA;
  const { data: cB } = await adminClient.from('clubs').insert({ name: 'RLS Test Club B', org_id: orgB.id }).select().single();
  clubB = cB;

  const { data: tA1 } = await adminClient
    .from('teams')
    .insert({ name: 'Club A - U15', category_id: categoryId, club_id: clubA.id })
    .select()
    .single();
  teamA1 = tA1;

  const { data: tA2 } = await adminClient
    .from('teams')
    .insert({ name: 'Club A - U17', category_id: categoryId, club_id: clubA.id })
    .select()
    .single();
  teamA2 = tA2;

  const { data: tB1 } = await adminClient
    .from('teams')
    .insert({ name: 'Club B - U15', category_id: categoryId, club_id: clubB.id })
    .select()
    .single();
  teamB1 = tB1;

  const { data: pA1 } = await adminClient
    .from('players')
    .insert({ name: 'Player A1', team_id: teamA1.id })
    .select()
    .single();
  playerA1 = pA1;

  const { data: pA2 } = await adminClient
    .from('players')
    .insert({ name: 'Player A2', team_id: teamA2.id })
    .select()
    .single();
  playerA2 = pA2;

  const { data: pB } = await adminClient
    .from('players')
    .insert({ name: 'Player B', team_id: teamB1.id })
    .select()
    .single();
  playerB = pB;

  // --- Users ---
  const coachA1 = await createTestUser('coach-a1@rls-test.local', 'team');
  const clubAdminA = await createTestUser('admin-a@rls-test.local', 'audience');
  const clubStaffB = await createTestUser('admin-b@rls-test.local', 'audience');
  const guardianA1 = await createTestUser('guardian-a1@rls-test.local', 'audience');
  // org_members role, not public.users.role -- this is the org-system's
  // own admin concept, separate from and not implied by users.role.
  const orgAdminA = await createTestUser('org-admin-a@rls-test.local', 'audience');
  await adminClient.from('org_members').insert({
    org_id: orgA.id,
    email: 'org-admin-a@rls-test.local',
    user_id: orgAdminA.publicUser.id,
    role: 'admin',
  });

  // Coach A1 is assigned to Team A1 via the EXISTING user_assigned_teams
  // mechanism -- this is what makes is_assigned_to_team() true for them.
  await adminClient.from('user_assigned_teams').insert({
    user_id: coachA1.publicUser.id,
    team_id: teamA1.id,
  });

  await adminClient.from('club_staff').insert([
    { club_id: clubA.id, user_id: clubAdminA.publicUser.id, role: 'club_admin' },
    { club_id: clubB.id, user_id: clubStaffB.publicUser.id, role: 'club_admin' },
    { club_id: clubA.id, user_id: coachA1.publicUser.id, role: 'coach' },
  ]);

  const { data: guardianRecord } = await adminClient
    .from('guardians')
    .insert({ user_id: guardianA1.publicUser.id, name: 'Guardian of A1' })
    .select()
    .single();

  await adminClient.from('player_guardians').insert({
    player_id: playerA1.id, // linked ONLY to playerA1
    guardian_id: guardianRecord.id,
    is_primary_contact: true,
  });

  coachA1Client = await signInAs('coach-a1@rls-test.local');
  clubAdminAClient = await signInAs('admin-a@rls-test.local');
  clubStaffBClient = await signInAs('admin-b@rls-test.local');
  guardianOfA1Client = await signInAs('guardian-a1@rls-test.local');
  orgAdminAClient = await signInAs('org-admin-a@rls-test.local');
});

afterAll(async () => {
  // Clubs cascade to club_staff/memberships/etc; teams.club_id is
  // ON DELETE SET NULL so deleting clubs won't cascade-delete teams --
  // clean those up explicitly along with players/users.
  await adminClient.from('players').delete().in('id', [playerA1.id, playerA2.id, playerB.id]);
  await adminClient.from('teams').delete().in('id', [teamA1.id, teamA2.id]);
  await adminClient.from('clubs').delete().in('id', [clubA.id, clubB.id]);
  await adminClient.from('organizations').delete().in('id', [orgA.id, orgB.id]);

  const { data: users } = await adminClient.auth.admin.listUsers();
  for (const email of [
    'coach-a1@rls-test.local',
    'admin-a@rls-test.local',
    'admin-b@rls-test.local',
    'guardian-a1@rls-test.local',
    'org-admin-a@rls-test.local',
  ]) {
    await adminClient.from('users').delete().eq('email', email); // public.users row
    const u = users.users.find((u) => u.email === email);
    if (u) await adminClient.auth.admin.deleteUser(u.id); // auth.users row
  }
});

describe('club-level isolation: clubs / club_staff', () => {
  it('club_admin at Club B CANNOT update Club A', async () => {
    const { data } = await clubStaffBClient.from('clubs').update({ name: 'Hijacked' }).eq('id', clubA.id).select();
    expect(data).toHaveLength(0);
  });

  it('club_admin at Club B CANNOT see Club A staff roster', async () => {
    const { data } = await clubStaffBClient.from('club_staff').select('*').eq('club_id', clubA.id);
    expect(data).toHaveLength(0);
  });
});

describe('org-level fencing: clubs.org_id (added 2026-08-27)', () => {
  it('org admin of Org A CAN insert a club into Org A', async () => {
    const { data, error } = await orgAdminAClient
      .from('clubs')
      .insert({ name: 'Org A New Club', org_id: orgA.id })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.org_id).toBe(orgA.id);
    if (data) await adminClient.from('clubs').delete().eq('id', data.id);
  });

  it('org admin of Org A CANNOT insert a club into Org B', async () => {
    const { data, error } = await orgAdminAClient
      .from('clubs')
      .insert({ name: 'Should Not Exist', org_id: orgB.id })
      .select();
    expect(data === null || data.length === 0).toBe(true);
    // Either RLS blocks the insert outright (error) or blocks the
    // subsequent select of the inserted row -- both are an effective
    // block; only a genuinely-successful cross-org insert should fail
    // this test.
    if (!error) {
      const { data: leaked } = await adminClient.from('clubs').select('id').eq('name', 'Should Not Exist').eq('org_id', orgB.id);
      expect(leaked).toHaveLength(0);
    }
  });

  it('org admin of Org A CAN read Club A (own org)', async () => {
    const { data } = await orgAdminAClient.from('clubs').select('*').eq('id', clubA.id);
    expect(data).toHaveLength(1);
  });

  it('org admin of Org A CANNOT read Club B (different org, not club staff there)', async () => {
    const { data } = await orgAdminAClient.from('clubs').select('*').eq('id', clubB.id);
    expect(data).toHaveLength(0);
  });

  it('club_admin of Club B can still read Club B even without any org_members row (club_staff fallback)', async () => {
    const { data } = await clubStaffBClient.from('clubs').select('*').eq('id', clubB.id);
    expect(data).toHaveLength(1);
  });
});

describe('player/guardian write access via club_staff (added 2026-08-27)', () => {
  it('club_staff of Club A CAN insert a player on Club A\'s own team', async () => {
    const { data, error } = await coachA1Client
      .from('players')
      .insert({ team_id: teamA1.id, name: 'New Player A' })
      .select()
      .single();
    expect(error).toBeNull();
    if (data) await adminClient.from('players').delete().eq('id', data.id);
  });

  it('club_staff of Club A CANNOT insert a player on Club B\'s team', async () => {
    const { data, error } = await coachA1Client
      .from('players')
      .insert({ team_id: teamB1.id, name: 'Should Not Exist' })
      .select();
    expect(data === null || data.length === 0).toBe(true);
    if (!error) {
      const { data: leaked } = await adminClient.from('players').select('id').eq('team_id', teamB1.id).eq('name', 'Should Not Exist');
      expect(leaked).toHaveLength(0);
    }
  });

  it('club_staff of Club A can create a guardian and read it back immediately (no player link yet)', async () => {
    const { data, error } = await clubAdminAClient
      .from('guardians')
      .insert({ name: 'New Guardian A' })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.name).toBe('New Guardian A');
    if (data) await adminClient.from('guardians').delete().eq('id', data.id);
  });

  it('club_staff of Club A can link a guardian they created to Player A2', async () => {
    const { data: guardian } = await clubAdminAClient.from('guardians').insert({ name: 'Linked Guardian A' }).select().single();
    const { error } = await clubAdminAClient.from('player_guardians').insert({ player_id: playerA2.id, guardian_id: guardian.id });
    expect(error).toBeNull();
    await adminClient.from('player_guardians').delete().eq('guardian_id', guardian.id);
    await adminClient.from('guardians').delete().eq('id', guardian.id);
  });
});

describe('team-level isolation: training_sessions / attendance (via existing user_assigned_teams)', () => {
  let sessionA1: { id: string };
  let sessionA2: { id: string };

  beforeAll(async () => {
    const { data: s1 } = await adminClient
      .from('training_sessions')
      .insert({
        club_id: clubA.id,
        team_id: teamA1.id,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 3600_000).toISOString(),
      })
      .select()
      .single();
    sessionA1 = s1;

    const { data: s2 } = await adminClient
      .from('training_sessions')
      .insert({
        club_id: clubA.id,
        team_id: teamA2.id,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 3600_000).toISOString(),
      })
      .select()
      .single();
    sessionA2 = s2;

    await adminClient.from('attendance').insert([
      { training_session_id: sessionA1.id, player_id: playerA1.id, status: 'present' },
      { training_session_id: sessionA2.id, player_id: playerA2.id, status: 'present' },
    ]);
  });

  it('coach assigned (via user_assigned_teams) to Team A1 CAN see Team A1 sessions', async () => {
    const { data } = await coachA1Client.from('training_sessions').select('*').eq('id', sessionA1.id);
    expect(data).toHaveLength(1);
  });

  it('coach assigned to Team A1 CANNOT see Team A2 sessions (same club)', async () => {
    const { data } = await coachA1Client.from('training_sessions').select('*').eq('id', sessionA2.id);
    expect(data).toHaveLength(0);
  });

  it('coach assigned to Team A1 CANNOT record attendance for Team A2', async () => {
    const { error } = await coachA1Client.from('attendance').insert({
      training_session_id: sessionA2.id,
      player_id: playerA2.id,
      status: 'present',
    });
    expect(error).not.toBeNull();
  });

  it('club_admin (club-wide) CAN see both teams\' sessions', async () => {
    const { data } = await clubAdminAClient
      .from('training_sessions')
      .select('*')
      .in('id', [sessionA1.id, sessionA2.id]);
    expect(data).toHaveLength(2);
  });
});

describe('guardian-level isolation: fee_charges', () => {
  let chargeA1: { id: string };
  let chargeA2: { id: string };

  beforeAll(async () => {
    const { data: c1 } = await adminClient
      .from('fee_charges')
      .insert({ club_id: clubA.id, player_id: playerA1.id, fee_type: 'registration', amount: 50 })
      .select()
      .single();
    chargeA1 = c1;

    const { data: c2 } = await adminClient
      .from('fee_charges')
      .insert({ club_id: clubA.id, player_id: playerA2.id, fee_type: 'registration', amount: 50 })
      .select()
      .single();
    chargeA2 = c2;
  });

  it('guardian can see their own linked player\'s fee charge', async () => {
    const { data } = await guardianOfA1Client.from('fee_charges').select('*').eq('id', chargeA1.id);
    expect(data).toHaveLength(1);
  });

  it('guardian CANNOT see a different player\'s fee charge, even same club', async () => {
    const { data } = await guardianOfA1Client.from('fee_charges').select('*').eq('id', chargeA2.id);
    expect(data).toHaveLength(0);
  });
});

describe('existing Tournament Manager functionality is unaffected', () => {
  it('teams table is still readable by any authenticated user (pre-existing policy)', async () => {
    const { data, error } = await clubAdminAClient.from('teams').select('*').eq('id', teamA1.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('players table is still readable by any authenticated user (pre-existing policy)', async () => {
    const { data, error } = await clubAdminAClient.from('players').select('*').eq('id', playerA1.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
