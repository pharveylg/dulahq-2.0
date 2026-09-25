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
 *   - 2026-09-07 (phase 1): identity is now auth.uid(). public.users.id
 *     IS auth.users.id, and a trigger on auth.users creates the profile
 *     row automatically. Test users are created with admin.createUser
 *     alone; the helper only UPDATEs the role afterwards.
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
let teamA1: { id: string };
let teamA2: { id: string };
let teamB1: { id: string };
let playerA1: { id: string };
let playerA2: { id: string };
let playerB: { id: string };

let feeA1: { id: string };
let feeA2: { id: string };

let guardianRecordId: string;
let coachA1UserId: string;
let teamManagerA1UserId: string;
let clubAdminAUserId: string;
let clubStaffBUserId: string;

let coachA1Client: ReturnType<typeof createClient>;
let clubAdminAClient: ReturnType<typeof createClient>;
let clubStaffBClient: ReturnType<typeof createClient>;
let guardianOfA1Client: ReturnType<typeof createClient>;
let orgAdminAClient: ReturnType<typeof createClient>;
let teamManagerA1Client: ReturnType<typeof createClient>;
let itAdminAClient: ReturnType<typeof createClient>;

/**
 * Creates the auth.users row. The phase-1 trigger creates the matching
 * public.users row with the SAME id, so we only set the role here.
 * Inserting a profile row manually would now violate the FK to auth.users.
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
    .update({ role, name: email.split('@')[0] })
    .eq('id', data.user.id)
    .select()
    .single();
  if (publicUserError) throw publicUserError;

  return { authUser: data.user, publicUser };
}

/**
 * Fixture inserts previously destructured only `data` and ignored `error`,
 * so a constraint violation surfaced as "Cannot read properties of null"
 * several lines further down. Unwrap loudly instead.
 */
function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`fixture "${what}" failed: ${res.error.message}`);
  if (!res.data) throw new Error(`fixture "${what}" returned no row`);
  return res.data;
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
  const suffix = crypto.randomUUID().slice(0, 8);
  orgA = must(await adminClient
    .from('organizations')
    .insert({ slug: `rls-test-org-a-${suffix}`, name: 'RLS Test Org A' })
    .select()
    .single(), 'organizations orgA');
  orgB = must(await adminClient
    .from('organizations')
    .insert({ slug: `rls-test-org-b-${suffix}`, name: 'RLS Test Org B' })
    .select()
    .single(), 'organizations orgB');

  // phase 2: the clubs write policy requires org_has_product(org_id,'club'),
  // so an org with no entitlement row cannot have clubs created in it.
  const entRes = await adminClient.from('org_entitlements').insert([
    { org_id: orgA.id, product: 'club' },
    { org_id: orgB.id, product: 'club' },
  ]);
  if (entRes.error) throw new Error(`fixture "org_entitlements" failed: ${entRes.error.message}`);

  // clubs.slug is NOT NULL with no default (add_club_and_team_slugs, 2026-09-03)
  // and is globally unique, so it must be supplied and suffixed.
  clubA = must(await adminClient
    .from('clubs')
    .insert({ name: 'RLS Test Club A', slug: `rls-test-club-a-${suffix}`, org_id: orgA.id })
    .select()
    .single(), 'clubs clubA');
  clubB = must(await adminClient
    .from('clubs')
    .insert({ name: 'RLS Test Club B', slug: `rls-test-club-b-${suffix}`, org_id: orgB.id })
    .select()
    .single(), 'clubs clubB');

  teamA1 = must(await adminClient
    .from('teams')
    .insert({ name: 'Club A - U15', club_id: clubA.id })
    .select()
    .single(), 'teams teamA1');

  teamA2 = must(await adminClient
    .from('teams')
    .insert({ name: 'Club A - U17', club_id: clubA.id })
    .select()
    .single(), 'teams teamA2');

  teamB1 = must(await adminClient
    .from('teams')
    .insert({ name: 'Club B - U15', club_id: clubB.id })
    .select()
    .single(), 'teams teamB1');

  playerA1 = must(await adminClient
    .from('players')
    .insert({ name: 'Player A1', team_id: teamA1.id })
    .select()
    .single(), 'players playerA1');

  playerA2 = must(await adminClient
    .from('players')
    .insert({ name: 'Player A2', team_id: teamA2.id })
    .select()
    .single(), 'players playerA2');

  playerB = must(await adminClient
    .from('players')
    .insert({ name: 'Player B', team_id: teamB1.id })
    .select()
    .single(), 'players playerB');

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

  // A team_manager on the SAME team as the coach -- the phase6k/6l role
  // split is only meaningful if the two can be compared on identical data.
  const teamManagerA1 = await createTestUser('tm-a1@rls-test.local', 'team');
  // The IT administrator (phase6n): technical authority, no business access.
  const itAdminA = await createTestUser('it-a@rls-test.local', 'audience');

  coachA1UserId = coachA1.publicUser.id;
  teamManagerA1UserId = teamManagerA1.publicUser.id;
  clubAdminAUserId = clubAdminA.publicUser.id;
  clubStaffBUserId = clubStaffB.publicUser.id;

  // Coach A1 is assigned to Team A1 via the EXISTING user_assigned_teams
  // mechanism -- this is what makes is_assigned_to_team() true for them.
  await adminClient.from('user_assigned_teams').insert([
    { user_id: coachA1.publicUser.id, team_id: teamA1.id },
    { user_id: teamManagerA1.publicUser.id, team_id: teamA1.id },
  ]);

  await adminClient.from('club_staff').insert([
    { club_id: clubA.id, user_id: clubAdminA.publicUser.id, role: 'club_manager' },
    { club_id: clubB.id, user_id: clubStaffB.publicUser.id, role: 'club_manager' },
    { club_id: clubA.id, user_id: coachA1.publicUser.id, role: 'coach' },
    { club_id: clubA.id, user_id: teamManagerA1.publicUser.id, role: 'team_manager' },
    { club_id: clubA.id, user_id: itAdminA.publicUser.id, role: 'club_it_admin' },
  ]);

  // One fee charge per team, so the team_manager's view_team_finance fence
  // (phase6m) has something to include AND something to exclude.
  feeA1 = must(await adminClient
    .from('fee_charges')
    .insert({ club_id: clubA.id, player_id: playerA1.id, fee_type: 'training', amount: 111 })
    .select()
    .single(), 'fee_charges feeA1');

  feeA2 = must(await adminClient
    .from('fee_charges')
    .insert({ club_id: clubA.id, player_id: playerA2.id, fee_type: 'training', amount: 222 })
    .select()
    .single(), 'fee_charges feeA2');

  const guardianRecord = must(await adminClient
    .from('guardians')
    .insert({ user_id: guardianA1.publicUser.id, name: 'Guardian of A1', org_id: orgA.id })
    .select()
    .single(), 'guardians guardianA1');

  await adminClient.from('player_guardians').insert({
    player_id: playerA1.id, // linked ONLY to playerA1
    guardian_id: guardianRecord.id,
    is_primary_contact: true,
  });

  guardianRecordId = guardianRecord.id;

  coachA1Client = await signInAs('coach-a1@rls-test.local');
  teamManagerA1Client = await signInAs('tm-a1@rls-test.local');
  itAdminAClient = await signInAs('it-a@rls-test.local');
  clubAdminAClient = await signInAs('admin-a@rls-test.local');
  clubStaffBClient = await signInAs('admin-b@rls-test.local');
  guardianOfA1Client = await signInAs('guardian-a1@rls-test.local');
  orgAdminAClient = await signInAs('org-admin-a@rls-test.local');
});

afterAll(async () => {
  // beforeAll may have thrown partway; skip anything that never got created.
  const ids = (...xs: ({ id: string } | undefined)[]) =>
    xs.map((x) => x?.id).filter((v): v is string => Boolean(v));

  // Clubs cascade to club_staff/memberships/etc; teams.club_id is
  // ON DELETE SET NULL so deleting clubs won't cascade-delete teams --
  // clean those up explicitly along with players/users.
  await adminClient.from('fee_charges').delete().in('id', ids(feeA1, feeA2));
  await adminClient.from('players').delete().in('id', ids(playerA1, playerA2, playerB));
  await adminClient.from('teams').delete().in('id', ids(teamA1, teamA2, teamB1));
  await adminClient.from('clubs').delete().in('id', ids(clubA, clubB));
  await adminClient.from('org_entitlements').delete().in('org_id', ids(orgA, orgB));
  await adminClient.from('organizations').delete().in('id', ids(orgA, orgB));

  const { data: users } = await adminClient.auth.admin.listUsers();
  for (const email of [
    'coach-a1@rls-test.local',
    'tm-a1@rls-test.local',
    'it-a@rls-test.local',
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
  it('club_manager at Club B CANNOT update Club A', async () => {
    const { data } = await clubStaffBClient.from('clubs').update({ name: 'Hijacked' }).eq('id', clubA.id).select();
    expect(data).toHaveLength(0);
  });

  it('club_manager at Club B CANNOT see Club A staff roster', async () => {
    const { data } = await clubStaffBClient.from('club_staff').select('*').eq('club_id', clubA.id);
    expect(data).toHaveLength(0);
  });
});

describe('org-level fencing: clubs.org_id (added 2026-08-27)', () => {
  it('org admin of Org A CAN insert a club into Org A', async () => {
    const { data, error } = await orgAdminAClient
      .from('clubs')
      .insert({ name: 'Org A New Club', org_id: orgA.id, slug: `rls-test-org-a-new-club-${crypto.randomUUID().slice(0, 8)}` })
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

  it('club_manager of Club B can still read Club B even without any org_members row (club_staff fallback)', async () => {
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
      .insert({ name: 'New Guardian A', org_id: orgA.id })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.name).toBe('New Guardian A');
    if (data) await adminClient.from('guardians').delete().eq('id', data.id);
  });

  it('club_staff of Club A can link a guardian they created to Player A2', async () => {
    const { data: guardian } = await clubAdminAClient.from('guardians').insert({ name: 'Linked Guardian A', org_id: orgA.id }).select().single();
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

  it('club_manager (club-wide) CAN see both teams\' sessions', async () => {
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

describe('teams / players are org-fenced (phase 2 replaced the open policies)', () => {
  it('club_manager of Club A CAN read their own club\'s team', async () => {
    const { data, error } = await clubAdminAClient.from('teams').select('*').eq('id', teamA1.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('club_manager of Club A CAN read their own club\'s player', async () => {
    const { data, error } = await clubAdminAClient.from('players').select('*').eq('id', playerA1.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  // Before phase 2 both of these returned the row: the policies were
  // `auth.role() = 'authenticated'`, i.e. any signed-in user, any org.
  it('club_manager of Club B CANNOT read Club A\'s team', async () => {
    const { data } = await clubStaffBClient.from('teams').select('*').eq('id', teamA1.id);
    expect(data).toHaveLength(0);
  });

  it('club_manager of Club B CANNOT read Club A\'s player', async () => {
    const { data } = await clubStaffBClient.from('players').select('*').eq('id', playerA1.id);
    expect(data).toHaveLength(0);
  });
});

/**
 * phase6k / phase6l / phase6m -- the role realignment.
 *
 * Before phase6l, `team_manager`'s default permission bundle was
 * byte-identical to `coach` (19 keys, including add_private_coach_note and
 * manage_development), which made the "development is Coach-owned" boundary
 * in the Team Manager spec pure fiction. These tests pin the split so it
 * can't silently regress: the coach and the team manager below are on the
 * SAME team, so any difference is the role, not the assignment.
 */
describe('role realignment: team_manager is not a coach clone', () => {
  const perm = async (
    client: ReturnType<typeof createClient>,
    key: string,
    teamId?: string
  ) => {
    const { data } = await client.rpc('has_staff_permission', {
      p_permission_key: key,
      p_club_id: clubA.id,
      ...(teamId ? { p_team_id: teamId } : {}),
    });
    return data;
  };

  it('coach CAN author private coach notes', async () => {
    expect(await perm(coachA1Client, 'add_private_coach_note', teamA1.id)).toBe(true);
  });

  it('team_manager CANNOT author private coach notes', async () => {
    expect(await perm(teamManagerA1Client, 'add_private_coach_note', teamA1.id)).toBe(false);
  });

  it('team_manager CANNOT manage development or add evaluations', async () => {
    expect(await perm(teamManagerA1Client, 'manage_development', teamA1.id)).toBe(false);
    expect(await perm(teamManagerA1Client, 'add_evaluation', teamA1.id)).toBe(false);
  });

  it('team_manager CAN still read development (operational visibility)', async () => {
    expect(await perm(teamManagerA1Client, 'view_development', teamA1.id)).toBe(true);
  });

  it('attendance stays Coach-recorded: team_manager views but cannot record', async () => {
    expect(await perm(coachA1Client, 'manage_attendance', teamA1.id)).toBe(true);
    expect(await perm(teamManagerA1Client, 'manage_attendance', teamA1.id)).toBe(false);
    expect(await perm(teamManagerA1Client, 'view_attendance', teamA1.id)).toBe(true);
  });

  // Product decision (recorded in CLAUDE.md §0d): finalization is coach OR
  // team_manager, and explicitly NOT the club_manager -- this deviates from
  // the Team Manager spec §15, which reserves it for the coach alone.
  it('finalize_tournament_roster belongs to coach and team_manager, not club_manager', async () => {
    expect(await perm(coachA1Client, 'finalize_tournament_roster', teamA1.id)).toBe(true);
    expect(await perm(teamManagerA1Client, 'finalize_tournament_roster', teamA1.id)).toBe(true);
    expect(await perm(clubAdminAClient, 'finalize_tournament_roster', teamA1.id)).toBe(false);
  });

  it('club_manager CANNOT author development records either', async () => {
    expect(await perm(clubAdminAClient, 'add_private_coach_note', teamA1.id)).toBe(false);
    expect(await perm(clubAdminAClient, 'manage_development', teamA1.id)).toBe(false);
  });
});

describe('role realignment: team_manager finance is fenced to assigned teams', () => {
  it('team_manager CAN read a fee charge for a player on their assigned team', async () => {
    const { data, error } = await teamManagerA1Client
      .from('fee_charges').select('*').eq('id', feeA1.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  // The whole reason view_team_finance had to be a NEW team-scope key
  // rather than granting the club-scope view_finances: has_staff_permission
  // short-circuits the team fence for club-scope keys, which would have
  // handed the team manager the entire club's finances.
  it('team_manager CANNOT read a fee charge for another team in the same club', async () => {
    const { data } = await teamManagerA1Client
      .from('fee_charges').select('*').eq('id', feeA2.id);
    expect(data).toHaveLength(0);
  });

  it('team_manager has no club-wide finance permission', async () => {
    const { data } = await teamManagerA1Client.rpc('has_staff_permission', {
      p_permission_key: 'view_finances',
      p_club_id: clubA.id,
    });
    expect(data).toBe(false);
  });

  it('club_manager still sees both teams\' fee charges', async () => {
    const { data } = await clubAdminAClient
      .from('fee_charges').select('*').in('id', [feeA1.id, feeA2.id]);
    expect(data).toHaveLength(2);
  });
});

/**
 * phase6n / phase6o / phase6p -- the IT role and "view as".
 *
 * The whole point of club_it_admin is what it CANNOT do, so that is what
 * these pin. The impersonation guards are enforced inside
 * start_impersonation(), never in the UI, so they are tested through the RPC.
 */
describe('club_it_admin: technical authority, zero business access', () => {
  it('holds the technical permissions and none of the business ones', async () => {
    const has = async (key: string) => {
      const { data } = await itAdminAClient.rpc('has_staff_permission', {
        p_permission_key: key,
        p_club_id: clubA.id,
      });
      return data;
    };
    expect(await has('impersonate_user')).toBe(true);
    expect(await has('view_audit_log')).toBe(true);
    expect(await has('view_player')).toBe(false);
    expect(await has('manage_finances')).toBe(false);
    expect(await has('manage_documents')).toBe(false);
    expect(await has('manage_staff')).toBe(false);
  });

  it('cannot read players, fee charges or memberships', async () => {
    const players = await itAdminAClient.from('players').select('*');
    const fees = await itAdminAClient.from('fee_charges').select('*');
    expect(players.data).toHaveLength(0);
    expect(fees.data).toHaveLength(0);
  });

  // is_club_staff() (any club_staff row, no role check) used to grant this.
  it('cannot link a guardian to a player', async () => {
    const { error } = await itAdminAClient
      .from('player_guardians')
      .insert({ player_id: playerA1.id, guardian_id: guardianRecordId, org_id: orgA.id })
      .select();
    expect(error).not.toBeNull();
  });

  it('is not a club manager', async () => {
    const { data } = await itAdminAClient.rpc('is_club_manager', { check_club_id: clubA.id });
    expect(data).toBe(false);
  });
});

describe('view-as sessions are guarded at the database', () => {
  it('refuses a caller without impersonate_user', async () => {
    const { error } = await coachA1Client.rpc('start_impersonation', {
      p_target_user_id: clubAdminAUserId,
      p_club_id: clubA.id,
      p_reason: 'should be refused',
    });
    expect(error).not.toBeNull();
  });

  it('refuses an empty reason', async () => {
    const { error } = await itAdminAClient.rpc('start_impersonation', {
      p_target_user_id: coachA1UserId,
      p_club_id: clubA.id,
      p_reason: '   ',
    });
    expect(error).not.toBeNull();
  });

  it('refuses a target who is not a member of the club', async () => {
    const { error } = await itAdminAClient.rpc('start_impersonation', {
      p_target_user_id: clubStaffBUserId, // club B
      p_club_id: clubA.id,
      p_reason: 'cross-club attempt',
    });
    expect(error).not.toBeNull();
  });

  it('refuses the readout without an active session', async () => {
    const { error } = await itAdminAClient.rpc('effective_access_for', {
      p_target_user_id: coachA1UserId,
      p_club_id: clubA.id,
    });
    expect(error).not.toBeNull();
  });

  it('a started session unlocks the readout, and reports the target accurately', async () => {
    const { data: sessionId, error } = await itAdminAClient.rpc('start_impersonation', {
      p_target_user_id: coachA1UserId,
      p_club_id: clubA.id,
      p_reason: 'rls suite: verifying the readout',
    });
    expect(error).toBeNull();
    expect(sessionId).toBeTruthy();

    const { data: readout } = await itAdminAClient.rpc('effective_access_for', {
      p_target_user_id: coachA1UserId,
      p_club_id: clubA.id,
    });
    const r = readout as any;
    expect(r.role).toBe('coach');
    const teamKeys = (r.team_permissions ?? []).map((p: any) => p.key);
    const missingKeys = (r.missing_permissions ?? []).map((p: any) => p.key);
    expect(teamKeys).toContain('add_private_coach_note');
    expect(missingKeys).toContain('view_team_finance');

    // The session is recorded and attributable, and cannot be deleted.
    const { error: delError } = await itAdminAClient
      .from('impersonation_sessions').delete().eq('id', sessionId as string).select();
    const { data: stillThere } = await itAdminAClient
      .from('impersonation_sessions').select('id').eq('id', sessionId as string);
    expect(stillThere).toHaveLength(1);
    expect(delError === null || stillThere?.length === 1).toBe(true);

    await itAdminAClient.rpc('end_impersonation', { p_session_id: sessionId as string });
    const { error: afterEnd } = await itAdminAClient.rpc('effective_access_for', {
      p_target_user_id: coachA1UserId,
      p_club_id: clubA.id,
    });
    expect(afterEnd).not.toBeNull();
  });
});

/**
 * phase6r -- the persisted roster proposal.
 *
 * The table exists so a proposal survives between people; these pin that it
 * is fenced to the entry's own team, since it now carries who a club intends
 * to send to a tournament.
 */
describe('tournament_roster_candidates is fenced to the entry team', () => {
  let entryId: string | null = null;

  it('sets up an accepted entry for team A1', async () => {
    const tournament = must(await adminClient
      .from('tournaments')
      .insert({ name: 'RLS Test Cup', org_id: orgA.id, slug: `rls-cup-${crypto.randomUUID().slice(0, 8)}` })
      .select().single(), 'tournaments');

    const entry = must(await adminClient
      .from('tournament_entries')
      .insert({
        tournament_id: tournament.id,
        host_org_id: orgA.id,
        entrant_org_id: orgA.id,
        club_id: clubA.id,
        team_id: teamA1.id,
        team_name: 'Club A - U15',
        status: 'accepted',
      })
      .select().single(), 'tournament_entries');
    entryId = entry.id;
    expect(entryId).toBeTruthy();
  });

  it('the assigned coach CAN propose a player', async () => {
    const { error } = await coachA1Client
      .from('tournament_roster_candidates')
      .insert({ org_id: orgA.id, entry_id: entryId!, player_id: playerA1.id })
      .select();
    expect(error).toBeNull();
  });

  it('the team manager on the same team CAN see the proposal', async () => {
    const { data } = await teamManagerA1Client
      .from('tournament_roster_candidates').select('*').eq('entry_id', entryId!);
    expect(data).toHaveLength(1);
  });

  // fill_tournament_roster is team-scoped, so a club_manager passes (club-wide)
  // but staff from another club must not.
  it('a club_manager from another club CANNOT propose', async () => {
    const { error } = await clubStaffBClient
      .from('tournament_roster_candidates')
      .insert({ org_id: orgA.id, entry_id: entryId!, player_id: playerA2.id })
      .select();
    expect(error).not.toBeNull();
  });

  it('the IT admin can neither see nor propose', async () => {
    const { data } = await itAdminAClient
      .from('tournament_roster_candidates').select('*').eq('entry_id', entryId!);
    expect(data).toHaveLength(0);

    const { error } = await itAdminAClient
      .from('tournament_roster_candidates')
      .insert({ org_id: orgA.id, entry_id: entryId!, player_id: playerA2.id })
      .select();
    expect(error).not.toBeNull();
  });

  it('cleans up', async () => {
    await adminClient.from('tournament_roster_candidates').delete().eq('entry_id', entryId!);
    await adminClient.from('tournament_entries').delete().eq('id', entryId!);
  });
});

/**
 * phase6s -- the anon-execute regression guard.
 *
 * phase2g revoked EXECUTE on every SECURITY DEFINER helper from anon, and it
 * regressed anyway, because EXECUTE defaults to PUBLIC on function creation:
 * every function added or recreated afterwards silently reopened. By the time
 * this test was written 25 of 46 were exposed again, including two mutating
 * ones (expire_stale_approvals, recompute_fee_status) and three that answer
 * questions about minors.
 *
 * A one-time revoke cannot hold that line -- this test is what does. It fails
 * the moment someone adds a SECURITY DEFINER function without revoking,
 * instead of the exposure sitting unnoticed for another few months.
 */
describe('no SECURITY DEFINER function is reachable by anon', () => {
  it('counts zero anon-executable security definer functions in public', async () => {
    const { data, error } = await clubAdminAClient.rpc('anon_executable_secdef_count');
    expect(error).toBeNull();
    expect(data).toBe(0);
  });

  it('anon genuinely cannot call a mutating helper', async () => {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { error } = await anonClient.rpc('expire_stale_approvals');
    expect(error).not.toBeNull();
  });

  it('anon cannot probe whether a player is a minor', async () => {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { error } = await anonClient.rpc('requires_guardian_consent', { p_player_id: playerA1.id });
    expect(error).not.toBeNull();
  });
});

/**
 * phase6t -- finalization authority is the club's, not the org admin's
 * (Club Manager spec §29: no generic admin override).
 */
describe('roster finalization cannot be overridden by an org admin', () => {
  let clubEntryId: string | null = null;

  it('sets up a club-backed accepted entry', async () => {
    const tournament = must(await adminClient
      .from('tournaments')
      .insert({ name: 'RLS Authz Cup', org_id: orgA.id, slug: `rls-authz-${crypto.randomUUID().slice(0, 8)}` })
      .select().single(), 'tournaments authz');

    const entry = must(await adminClient
      .from('tournament_entries')
      .insert({
        tournament_id: tournament.id,
        host_org_id: orgA.id,
        entrant_org_id: orgA.id,
        club_id: clubA.id,
        team_id: teamA1.id,
        team_name: 'Club A - U15',
        status: 'accepted',
      })
      .select().single(), 'tournament_entries authz');
    clubEntryId = entry.id;
    expect(clubEntryId).toBeTruthy();
  });

  it('the org admin CANNOT finalize a club-backed entry', async () => {
    const { error } = await orgAdminAClient.rpc('port_squad_to_tournament', {
      p_entry_id: clubEntryId!,
      p_player_ids: [],
    });
    expect(error).not.toBeNull();
  });

  it('the assigned coach CAN', async () => {
    const { error } = await coachA1Client.rpc('port_squad_to_tournament', {
      p_entry_id: clubEntryId!,
      p_player_ids: [],
    });
    expect(error).toBeNull();
  });

  it('cleans up', async () => {
    await adminClient.from('tournament_entries').delete().eq('id', clubEntryId!);
  });
});

/**
 * phase6w. Before it, a tournament_roster row was immutable -- and it still is
 * to everyone except this RPC, since tournament_roster's write policy belongs
 * to the HOST org (`roster_host_write` = is_org_admin(org_id)), so club staff
 * have no direct write path to their own ported rows at all.
 *
 * The gate is deliberately the same one the port uses, so these pin both
 * directions: taking a player off must be exactly as hard as putting one on,
 * and in particular the club manager must be refused (Club Manager spec §29 --
 * otherwise the admin override forbidden on the way in reappears on the way
 * out).
 */
describe('withdrawing a player from a finalized roster', () => {
  let entryId: string | null = null;
  let adultId: string | null = null;
  let rosterId: string | null = null;

  it('sets up a finalized roster with one adult on it', async () => {
    const tournament = must(await adminClient
      .from('tournaments')
      .insert({ name: 'RLS Withdraw Cup', org_id: orgA.id, slug: `rls-wd-${crypto.randomUUID().slice(0, 8)}` })
      .select().single(), 'tournaments withdraw');

    const entry = must(await adminClient
      .from('tournament_entries')
      .insert({
        tournament_id: tournament.id,
        host_org_id: orgA.id,
        entrant_org_id: orgA.id,
        club_id: clubA.id,
        team_id: teamA1.id,
        team_name: 'Club A - U15',
        status: 'accepted',
      })
      .select().single(), 'tournament_entries withdraw');
    entryId = entry.id;

    // An explicit dob is required: requires_guardian_consent() defaults to
    // TRUE when dob is unknown (CLAUDE.md §5), so the other player fixtures
    // would come back consent_missing and never port.
    const adult = must(await adminClient
      .from('players')
      .insert({ name: 'Adult A1', team_id: teamA1.id, dob: '1994-01-01' })
      .select().single(), 'players adult');
    adultId = adult.id;

    const { data, error } = await coachA1Client.rpc('port_squad_to_tournament', {
      p_entry_id: entryId!,
      p_player_ids: [adultId!],
    });
    expect(error).toBeNull();
    expect((data as any[])[0].outcome).toBe('ported');
    rosterId = (data as any[])[0].roster_id;
  });

  it('porting the same player again is a no-op, not a duplicate row', async () => {
    const { data } = await coachA1Client.rpc('port_squad_to_tournament', {
      p_entry_id: entryId!,
      p_player_ids: [adultId!],
    });
    expect((data as any[])[0].outcome).toBe('already_rostered');

    const { count } = await adminClient
      .from('tournament_roster')
      .select('id', { count: 'exact', head: true })
      .eq('entry_id', entryId!);
    expect(count).toBe(1);
  });

  it('the club manager CANNOT withdraw a player (spec §29 applies both ways)', async () => {
    const { error } = await clubAdminAClient.rpc('withdraw_from_tournament_roster', {
      p_roster_id: rosterId!,
      p_reason: 'because I said so',
    });
    expect(error).not.toBeNull();
  });

  it('the IT admin CANNOT withdraw a player', async () => {
    const { error } = await itAdminAClient.rpc('withdraw_from_tournament_roster', {
      p_roster_id: rosterId!,
      p_reason: 'support request',
    });
    expect(error).not.toBeNull();
  });

  it('a withdrawal must say why', async () => {
    const { error } = await coachA1Client.rpc('withdraw_from_tournament_roster', {
      p_roster_id: rosterId!,
      p_reason: '   ',
    });
    expect(error).not.toBeNull();
  });

  it('the assigned coach CAN, and the row is kept as history', async () => {
    const { data, error } = await coachA1Client.rpc('withdraw_from_tournament_roster', {
      p_roster_id: rosterId!,
      p_reason: 'Ankle injury',
    });
    expect(error).toBeNull();
    expect((data as any[])[0].new_revision).toBe(2);

    const row = must(await adminClient
      .from('tournament_roster').select('status, added_in_revision, withdrawn_in_revision, reject_reason')
      .eq('id', rosterId!).single(), 'withdrawn row');
    expect(row.status).toBe('withdrawn');
    expect(row.added_in_revision).toBe(1);
    expect(row.withdrawn_in_revision).toBe(2);
    expect(row.reject_reason).toBe('Ankle injury');
  });

  it('the same row cannot be withdrawn twice', async () => {
    const { error } = await coachA1Client.rpc('withdraw_from_tournament_roster', {
      p_roster_id: rosterId!,
      p_reason: 'again',
    });
    expect(error).not.toBeNull();
  });

  // The whole point of keeping the row: what was submitted at revision 1 is
  // still answerable after revision 2 changed it.
  it('the roster as submitted at revision 1 is still reconstructible', async () => {
    const { count } = await adminClient
      .from('tournament_roster')
      .select('id', { count: 'exact', head: true })
      .eq('entry_id', entryId!)
      .lte('added_in_revision', 1)
      .or('withdrawn_in_revision.is.null,withdrawn_in_revision.gt.1');
    expect(count).toBe(1);
  });

  it('a withdrawn player can be re-added, as a new row at a new revision', async () => {
    const { data } = await coachA1Client.rpc('port_squad_to_tournament', {
      p_entry_id: entryId!,
      p_player_ids: [adultId!],
    });
    expect((data as any[])[0].outcome).toBe('ported');

    const { count } = await adminClient
      .from('tournament_roster')
      .select('id', { count: 'exact', head: true })
      .eq('entry_id', entryId!)
      .eq('added_in_revision', 3);
    expect(count).toBe(1);
  });

  // The finalize deviation recorded in §0d ("only coach or team manager")
  // has to hold on the withdrawal side too, or the two ends disagree.
  it('the team manager on the same team CAN also withdraw', async () => {
    const fresh = must(await adminClient
      .from('tournament_roster').select('id').eq('entry_id', entryId!).eq('added_in_revision', 3).single(),
      'fresh roster row');
    const { error } = await teamManagerA1Client.rpc('withdraw_from_tournament_roster', {
      p_roster_id: fresh.id,
      p_reason: 'Squad change',
    });
    expect(error).toBeNull();
  });

  it('cleans up', async () => {
    await adminClient.from('tournament_entries').delete().eq('id', entryId!);
    await adminClient.from('players').delete().eq('id', adultId!);
  });
});

/**
 * phase6x. Two things at once, because checking the database turned the
 * second one up while building the first.
 *
 * The feature: "primary coach" is a fact about an *assignment*, not about a
 * person -- club_staff.role is club-wide -- so it lives on
 * user_assigned_teams, and Team Manager spec §9 ("may assign coaches but not
 * remove the primary coach") becomes expressible for the first time.
 *
 * The bug: user_assigned_teams' write policy was is_org_admin(org_id) for
 * every command, so the club manager -- who is generally not an org admin --
 * could not assign anyone to a team at all, while the UI showed them the
 * control. The first test below is that regression.
 */
describe('team staff assignment and the primary coach', () => {
  let coachA2UserId: string | null = null;

  const perm = async (client: ReturnType<typeof createClient>, key: string, teamId?: string) => {
    const { data } = await client.rpc('has_staff_permission', {
      p_permission_key: key,
      p_club_id: clubA.id,
      ...(teamId ? { p_team_id: teamId } : {}),
    });
    return data;
  };

  it('adds a second coach at club A to have someone to assign', async () => {
    const second = await createTestUser('coach-a2@rls-test.local', 'team');
    coachA2UserId = second.publicUser.id;
    must(await adminClient.from('club_staff')
      .insert({ club_id: clubA.id, user_id: coachA2UserId, role: 'coach' })
      .select().single(), 'club_staff coachA2');
  });

  it('assign_team_staff is held by club_manager and team_manager, not the coach', async () => {
    expect(await perm(clubAdminAClient, 'assign_team_staff', teamA1.id)).toBe(true);
    expect(await perm(teamManagerA1Client, 'assign_team_staff', teamA1.id)).toBe(true);
    expect(await perm(coachA1Client, 'assign_team_staff', teamA1.id)).toBe(false);
  });

  // The regression. Before phase6x this insert was refused with 42501.
  it('the club manager CAN assign staff to a team', async () => {
    const { error } = await clubAdminAClient
      .from('user_assigned_teams')
      .insert({ user_id: coachA2UserId!, team_id: teamA1.id });
    expect(error).toBeNull();
  });

  it('the team manager CANNOT reach a team they are not assigned to', async () => {
    const { error } = await teamManagerA1Client
      .from('user_assigned_teams')
      .insert({ user_id: coachA2UserId!, team_id: teamA2.id });
    expect(error).not.toBeNull();
  });

  it('nobody can insert themselves straight in as primary', async () => {
    await adminClient.from('user_assigned_teams')
      .delete().eq('user_id', coachA2UserId!).eq('team_id', teamA1.id);
    const { error } = await clubAdminAClient
      .from('user_assigned_teams')
      .insert({ user_id: coachA2UserId!, team_id: teamA1.id, is_primary: true });
    expect(error).not.toBeNull();

    // put them back, unprimaried, for the rest of the block
    must(await clubAdminAClient.from('user_assigned_teams')
      .insert({ user_id: coachA2UserId!, team_id: teamA1.id }).select().single(), 'reassign coachA2');
  });

  it('the team manager CANNOT designate the primary coach', async () => {
    const { error } = await teamManagerA1Client.rpc('set_team_primary_coach', {
      p_team_id: teamA1.id,
      p_user_id: coachA1UserId,
    });
    expect(error).not.toBeNull();
  });

  it('the club manager CAN, and only a coach may hold it', async () => {
    const bad = await clubAdminAClient.rpc('set_team_primary_coach', {
      p_team_id: teamA1.id,
      p_user_id: teamManagerA1UserId,
    });
    expect(bad.error).not.toBeNull();

    const { error } = await clubAdminAClient.rpc('set_team_primary_coach', {
      p_team_id: teamA1.id,
      p_user_id: coachA1UserId,
    });
    expect(error).toBeNull();

    const row = must(await adminClient
      .from('user_assigned_teams').select('is_primary')
      .eq('team_id', teamA1.id).eq('user_id', coachA1UserId).single(), 'primary row');
    expect(row.is_primary).toBe(true);
  });

  // The rule this phase exists for.
  it('the team manager CANNOT remove the primary coach', async () => {
    await teamManagerA1Client
      .from('user_assigned_teams')
      .delete().eq('user_id', coachA1UserId).eq('team_id', teamA1.id);

    // RLS filters a DELETE rather than raising, so the proof is that the row
    // survived -- which is exactly why the server action checks the row count.
    const { count } = await adminClient
      .from('user_assigned_teams')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', coachA1UserId).eq('team_id', teamA1.id);
    expect(count).toBe(1);
  });

  it('the team manager CAN remove a non-primary coach from their own team', async () => {
    await teamManagerA1Client
      .from('user_assigned_teams')
      .delete().eq('user_id', coachA2UserId!).eq('team_id', teamA1.id);

    const { count } = await adminClient
      .from('user_assigned_teams')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', coachA2UserId!).eq('team_id', teamA1.id);
    expect(count).toBe(0);
  });

  it('handing the lead over demotes the previous holder in one step', async () => {
    must(await clubAdminAClient.from('user_assigned_teams')
      .insert({ user_id: coachA2UserId!, team_id: teamA1.id }).select().single(), 'reassign for handover');

    const { error } = await clubAdminAClient.rpc('set_team_primary_coach', {
      p_team_id: teamA1.id,
      p_user_id: coachA2UserId,
    });
    expect(error).toBeNull();

    const { data } = await adminClient
      .from('user_assigned_teams').select('user_id, is_primary').eq('team_id', teamA1.id);
    const primaries = (data ?? []).filter((r) => r.is_primary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].user_id).toBe(coachA2UserId);
  });

  it('the club manager CAN clear the designation entirely', async () => {
    const { error } = await clubAdminAClient.rpc('set_team_primary_coach', {
      p_team_id: teamA1.id,
      p_user_id: null,
    });
    expect(error).toBeNull();

    const { count } = await adminClient
      .from('user_assigned_teams')
      .select('user_id', { count: 'exact', head: true })
      .eq('team_id', teamA1.id).eq('is_primary', true);
    expect(count).toBe(0);
  });

  it('cleans up', async () => {
    await adminClient.from('club_staff').delete().eq('user_id', coachA2UserId!);
    await adminClient.from('user_assigned_teams').delete().eq('user_id', coachA2UserId!);
    await adminClient.auth.admin.deleteUser(coachA2UserId!);
  });
});

/**
 * Club entitlement P0 batch (docs/club-entitlement-gap-analysis.md).
 *
 * P0-5: club_staff gains a real status lifecycle. Every authorization
 * helper that reads club_staff.role has to also honour status, or archiving
 * someone is cosmetic -- they'd keep every permission their role bundle
 * grants. This pins the two ends: active still works, archived doesn't.
 */
describe('club_staff status lifecycle (phase6z)', () => {
  let extraCoachUserId: string | null = null;

  it('a freshly-added, active staff member holds their bundle', async () => {
    const extra = await createTestUser('coach-lifecycle@rls-test.local', 'team');
    extraCoachUserId = extra.publicUser.id;
    must(await adminClient.from('club_staff')
      .insert({ club_id: clubA.id, user_id: extraCoachUserId, role: 'coach' })
      .select().single(), 'club_staff extraCoach');

    const client = await signInAs('coach-lifecycle@rls-test.local');
    const { data } = await client.rpc('has_staff_permission', {
      p_permission_key: 'view_team', p_club_id: clubA.id, p_team_id: teamA1.id,
    });
    expect(data).toBe(false); // not assigned to teamA1 yet, and view_team is team-scoped
    await client.auth.signOut();
  });

  it('archiving removes has_staff_permission / is_club_staff / is_club_manager, even though the row still exists', async () => {
    await adminClient.from('club_staff').update({ status: 'archived' })
      .eq('club_id', clubA.id).eq('user_id', extraCoachUserId!);

    const client = await signInAs('coach-lifecycle@rls-test.local');
    const perm = await client.rpc('has_staff_permission', {
      p_permission_key: 'view_team', p_club_id: clubA.id, p_team_id: teamA1.id,
    });
    const staff = await client.rpc('is_club_staff', { check_club_id: clubA.id });
    const manager = await client.rpc('is_club_manager', { check_club_id: clubA.id });
    expect(perm.data).toBe(false);
    expect(staff.data).toBe(false);
    expect(manager.data).toBe(false);

    const { count } = await adminClient.from('club_staff')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubA.id).eq('user_id', extraCoachUserId!);
    expect(count).toBe(1); // the row survives -- it's archived, not deleted
    await client.auth.signOut();
  });

  it('an archived coach cannot be designated a team\'s primary coach', async () => {
    await adminClient.from('user_assigned_teams').insert({ user_id: extraCoachUserId!, team_id: teamA1.id });
    const { error } = await clubAdminAClient.rpc('set_team_primary_coach', {
      p_team_id: teamA1.id, p_user_id: extraCoachUserId,
    });
    expect(error).not.toBeNull();
    await adminClient.from('user_assigned_teams').delete().eq('user_id', extraCoachUserId!).eq('team_id', teamA1.id);
  });

  it('club_staff_directory returns real names for whoever could already read the full roster', async () => {
    const { data, error } = await clubAdminAClient.rpc('club_staff_directory', { p_club_id: clubA.id });
    expect(error).toBeNull();
    const row = (data ?? []).find((d: any) => d.user_id === coachA1UserId);
    expect(row?.name).toBeTruthy();
    expect(row?.email).toContain('@rls-test.local');
  });

  it('cleans up', async () => {
    await adminClient.from('club_staff').delete().eq('user_id', extraCoachUserId!);
    await adminClient.auth.admin.deleteUser(extraCoachUserId!);
  });
});

/**
 * P0-2: three guardian permissions were granted to every guardian by
 * default and implemented nothing anywhere in the app. Removed from the
 * catalog entirely rather than left standing.
 */
describe('dead guardian permissions removed (phase6z)', () => {
  it('the three keys no longer exist in the permission catalog', async () => {
    const { data } = await adminClient
      .from('permissions')
      .select('key')
      .in('key', ['communicate_with_club', 'manage_availability', 'manage_forms']);
    expect(data).toHaveLength(0);
  });

  it('no default bundle still references them', async () => {
    const { data } = await adminClient
      .from('guardian_permission_defaults')
      .select('permission_key')
      .in('permission_key', ['communicate_with_club', 'manage_availability', 'manage_forms']);
    expect(data).toHaveLength(0);
  });
});

/**
 * Two more bugs surfaced while verifying the P0 batch live, both the same
 * shape as phase6x's team-assignment bug: a permission or capability the
 * app already offered a club_manager, that the underlying RLS never
 * actually honoured.
 */
describe('bugs found while verifying the P0 batch live (phase6z1/6z2)', () => {
  it('clubs_admin_write: a club_manager CAN update their own club (was WITH CHECK = org_admin only)', async () => {
    const { data: before } = await adminClient.from('clubs').select('about').eq('id', clubA.id).single();
    const { error } = await clubAdminAClient.from('clubs').update({ about: 'rls-test edit' }).eq('id', clubA.id);
    expect(error).toBeNull();
    await adminClient.from('clubs').update({ about: before?.about ?? null }).eq('id', clubA.id);
  });

  it('club_audit_log: a club_manager sees their own club-scoped rows', async () => {
    await adminClient.rpc('write_audit', {
      p_org_id: orgA.id,
      p_action: 'staff.added',
      p_scope_type: 'club',
      p_scope_id: clubA.id,
      p_entity_type: 'club_staff',
      p_entity_id: crypto.randomUUID(),
    });
    const { data, error } = await clubAdminAClient.rpc('club_audit_log', { p_club_id: clubA.id });
    expect(error).toBeNull();
    expect((data ?? []).some((r: any) => r.action === 'staff.added')).toBe(true);
  });

  it('club_audit_log: a club_manager of a DIFFERENT club reads nothing for this one', async () => {
    const { data, error } = await clubStaffBClient.rpc('club_audit_log', { p_club_id: clubA.id });
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});

/**
 * Club entitlement P1 batch (docs/club-entitlement-gap-analysis.md).
 */
describe('club_staff_directory includes the caller\'s own row even without can_read_club (phase7c)', () => {
  it('a plain coach sees their OWN name, not just everyone else\'s', async () => {
    const { data, error } = await coachA1Client.rpc('club_staff_directory', { p_club_id: clubA.id });
    expect(error).toBeNull();
    const own = (data ?? []).find((d: any) => d.user_id === coachA1UserId);
    expect(own?.name).toBeTruthy();
    // and still cannot see a teammate's row via this same call, since they
    // don't hold can_read_club -- only the self branch let them through.
    expect((data ?? []).length).toBe(1);
  });
});

describe('staff_profiles (P1-7)', () => {
  let profileClubStaffId: string;

  it('finds the coach\'s own club_staff row', async () => {
    const row = must(await adminClient.from('club_staff').select('id')
      .eq('club_id', clubA.id).eq('user_id', coachA1UserId).single(), 'coach club_staff row');
    profileClubStaffId = row.id;
  });

  it('the coach CAN write their own profile', async () => {
    const { error } = await coachA1Client.from('staff_profiles').upsert({
      club_staff_id: profileClubStaffId, club_id: clubA.id, org_id: orgA.id,
      phone: '0900-000-0000', bio: 'Test bio',
    });
    expect(error).toBeNull();
  });

  it('a DIFFERENT coach CANNOT write into it', async () => {
    const { error } = await teamManagerA1Client
      .from('staff_profiles')
      .update({ bio: 'hacked' })
      .eq('club_staff_id', profileClubStaffId);
    // RLS filters rather than raising on UPDATE with no matching row visible
    // for write -- confirm nothing actually changed.
    const row = must(await adminClient.from('staff_profiles').select('bio')
      .eq('club_staff_id', profileClubStaffId).single(), 'profile after attempted hack');
    expect(row.bio).toBe('Test bio');
    expect(error).toBeNull();
  });

  it('the club manager CAN write someone else\'s profile (the can_admin_club fallback)', async () => {
    const { error } = await clubAdminAClient.from('staff_profiles').upsert({
      club_staff_id: profileClubStaffId, club_id: clubA.id, org_id: orgA.id, bio: 'Set by manager',
    });
    expect(error).toBeNull();
  });

  it('cleans up', async () => {
    await adminClient.from('staff_profiles').delete().eq('club_staff_id', profileClubStaffId);
  });
});

describe('staff_holding_permission (P1-8)', () => {
  it('resolves the coach and team_manager, who both hold finalize_tournament_roster', async () => {
    const { data, error } = await adminClient.rpc('staff_holding_permission', {
      p_club_id: clubA.id, p_permission_key: 'finalize_tournament_roster', p_team_id: teamA1.id,
    });
    expect(error).toBeNull();
    expect(data).toEqual(expect.arrayContaining([coachA1UserId, teamManagerA1UserId]));
  });

  it('does not resolve a coach assigned to a different team', async () => {
    const { data } = await adminClient.rpc('staff_holding_permission', {
      p_club_id: clubA.id, p_permission_key: 'finalize_tournament_roster', p_team_id: teamA2.id,
    });
    expect(data ?? []).not.toContain(coachA1UserId);
  });
});

describe('set_staff_account_status (P1-11)', () => {
  it('a plain coach CANNOT suspend anyone (lacks manage_account_status)', async () => {
    const { error } = await coachA1Client.rpc('set_staff_account_status', {
      p_club_id: clubA.id, p_target_user_id: teamManagerA1UserId, p_status: 'suspended',
    });
    expect(error).not.toBeNull();
  });

  it('nobody can change their own status', async () => {
    const { error } = await clubAdminAClient.rpc('set_staff_account_status', {
      p_club_id: clubA.id, p_target_user_id: clubAdminAUserId, p_status: 'suspended',
    });
    expect(error).not.toBeNull();
  });
});

describe('support_requests (P1-10)', () => {
  let requestId: string;

  it('the club manager CAN file a request', async () => {
    const { data, error } = await clubAdminAClient.from('support_requests').insert({
      org_id: orgA.id, created_by: clubAdminAUserId, category: 'bug', subject: 'RLS test', body: 'testing',
    }).select('id').single();
    expect(error).toBeNull();
    requestId = data!.id;
  });

  it('a plain coach CANNOT file one (lacks submit_support_request)', async () => {
    const { error } = await coachA1Client.from('support_requests').insert({
      org_id: orgA.id, created_by: coachA1UserId, category: 'bug', subject: 'should fail', body: 'testing',
    });
    expect(error).not.toBeNull();
  });

  it('a club_manager at a DIFFERENT org cannot see it', async () => {
    const { data } = await clubStaffBClient.from('support_requests').select('id').eq('id', requestId);
    expect(data ?? []).toHaveLength(0);
  });

  it('the creator can reply to their own request', async () => {
    const { error } = await clubAdminAClient.from('support_request_messages').insert({
      request_id: requestId, author_user_id: clubAdminAUserId, body: 'follow-up',
    });
    expect(error).toBeNull();
  });

  it('a club_manager cannot change the request status -- platform-owned', async () => {
    const { error } = await clubAdminAClient.from('support_requests').update({ status: 'resolved' }).eq('id', requestId);
    const row = must(await adminClient.from('support_requests').select('status').eq('id', requestId).single(), 'status after attempted client edit');
    expect(row.status).toBe('open');
    expect(error).toBeNull();
  });

  it('cleans up', async () => {
    await adminClient.from('support_requests').delete().eq('id', requestId);
  });
});

/**
 * Tournament RBAC (2026-09-09, "tournament.md" proposal review). The
 * Tournament Role layer (tournament_staff), mirroring club_staff's proven
 * shape -- and the External Organization access mechanism
 * (tournament_entry_contacts), which has no club_staff/tournament_staff
 * equivalent to reuse since a cold external contact belongs to no org at
 * all.
 */
describe('tournament_staff (Tournament Role layer)', () => {
  let tournamentId: string;
  let entryId: string;

  it('sets up a tournament and an accepted club-backed entry', async () => {
    const tournament = must(await adminClient
      .from('tournaments')
      .insert({ name: 'RLS Tournament RBAC Cup', org_id: orgA.id, slug: `rls-trbac-${crypto.randomUUID().slice(0, 8)}` })
      .select().single(), 'tournaments trbac');
    tournamentId = tournament.id;

    const entry = must(await adminClient
      .from('tournament_entries')
      .insert({
        tournament_id: tournamentId,
        host_org_id: orgA.id,
        entrant_org_id: orgA.id,
        club_id: clubA.id,
        team_id: teamA1.id,
        team_name: 'Club A - U15',
        status: 'accepted',
      })
      .select().single(), 'tournament_entries trbac');
    entryId = entry.id;
  });

  it('a club_manager CANNOT bootstrap themselves as Organizer -- only org_admin can', async () => {
    const { error } = await clubAdminAClient.from('tournament_staff').insert({
      tournament_id: tournamentId, user_id: clubAdminAUserId, role: 'organizer', org_id: orgA.id,
    });
    expect(error).not.toBeNull();
  });

  it('the org admin CAN bootstrap the first Organizer', async () => {
    const { error } = await orgAdminAClient.from('tournament_staff').insert({
      tournament_id: tournamentId, user_id: coachA1UserId, role: 'organizer', org_id: orgA.id,
    });
    expect(error).toBeNull();
  });

  it('the Organizer holds manage_competition and decide_tournament_entry', async () => {
    const organizerClient = coachA1Client;
    const manage = await organizerClient.rpc('has_tournament_permission', { p_permission_key: 'manage_competition', p_tournament_id: tournamentId });
    const decide = await organizerClient.rpc('has_tournament_permission', { p_permission_key: 'decide_tournament_entry', p_tournament_id: tournamentId });
    expect(manage.data).toBe(true);
    expect(decide.data).toBe(true);
  });

  it('a tournament treasurer does NOT get view_player just because the role string is shared with club_staff', async () => {
    must(await adminClient.from('tournament_staff').insert({
      tournament_id: tournamentId, user_id: teamManagerA1UserId, role: 'treasurer', org_id: orgA.id,
    }).select().single(), 'tournament_staff treasurer');

    const finances = await teamManagerA1Client.rpc('has_tournament_permission', { p_permission_key: 'manage_tournament_finances', p_tournament_id: tournamentId });
    const leak = await teamManagerA1Client.rpc('has_tournament_permission', { p_permission_key: 'view_player', p_tournament_id: tournamentId });
    expect(finances.data).toBe(true);
    expect(leak.data).toBe(false);
  });

  it('tournament_staff_directory shows a treasurer their OWN name even without organizer/org_admin visibility', async () => {
    const { data, error } = await teamManagerA1Client.rpc('tournament_staff_directory', { p_tournament_id: tournamentId });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect((data as any[])[0].role).toBe('treasurer');
  });

  it('set_tournament_staff_account_status: a treasurer cannot suspend anyone (lacks manage_account_status)', async () => {
    const { error } = await teamManagerA1Client.rpc('set_tournament_staff_account_status', {
      p_tournament_id: tournamentId, p_target_user_id: coachA1UserId, p_status: 'suspended',
    });
    expect(error).not.toBeNull();
  });

  it('decide_tournament_entry: a non-organizer is refused', async () => {
    const { error } = await teamManagerA1Client.rpc('decide_tournament_entry', { p_entry_id: entryId, p_status: 'declined' });
    expect(error).not.toBeNull();
  });

  it('decide_tournament_entry: the Organizer can accept, and it is audited', async () => {
    const { error } = await coachA1Client.rpc('decide_tournament_entry', { p_entry_id: entryId, p_status: 'accepted' });
    expect(error).toBeNull();
    const row = must(await adminClient.from('tournament_entries').select('status').eq('id', entryId).single(), 'entry after decide');
    expect(row.status).toBe('accepted');
  });

  it('tournament_officials write requires manage_officiating or org_admin', async () => {
    const { error: refused } = await teamManagerA1Client.from('tournament_officials').insert({
      org_id: orgA.id, tournament_id: tournamentId, official_id: crypto.randomUUID(), role: 'referee',
    });
    expect(refused).not.toBeNull();

    must(await adminClient.from('tournament_staff').insert({
      tournament_id: tournamentId, user_id: coachA1UserId, role: 'referee_coordinator', org_id: orgA.id,
    }).select().single(), 'tournament_staff referee_coordinator');
    // coachA1 already holds organizer too (same user, two roles) -- either
    // grants manage_officiating, which is exactly the point: role bundles
    // are additive per person, not exclusive.
    const officialRow = must(await adminClient.from('org_officials').insert({
      org_id: orgA.id, full_name: 'RLS Test Referee',
    }).select().single(), 'org_officials rls test');
    const { error: allowed } = await coachA1Client.from('tournament_officials').insert({
      org_id: orgA.id, tournament_id: tournamentId, official_id: officialRow.id, role: 'referee',
    });
    expect(allowed).toBeNull();
    await adminClient.from('org_officials').delete().eq('id', officialRow.id);
  });

  it('support_requests: a tournament organizer can now file one (widened in phase8c)', async () => {
    const { data, error } = await coachA1Client.from('support_requests').insert({
      org_id: orgA.id, created_by: coachA1UserId, category: 'bug', subject: 'tournament RLS test', body: 'testing',
    }).select('id').single();
    expect(error).toBeNull();
    if (data) await adminClient.from('support_requests').delete().eq('id', data.id);
  });

  it('cleans up', async () => {
    await adminClient.from('tournament_entries').delete().eq('id', entryId);
    await adminClient.from('tournament_staff').delete().eq('tournament_id', tournamentId);
    await adminClient.from('tournaments').delete().eq('id', tournamentId);
  });
});

describe('tournament_entry_contacts (External Organization access)', () => {
  let tournamentId: string;
  let entryId: string;
  let contactId: string;
  const externalEmail = `rls-external-${crypto.randomUUID().slice(0, 8)}@rls-test.local`;
  let externalUser: { publicUser: { id: string } };
  let externalClient: ReturnType<typeof createClient>;

  it('sets up a club-less accepted entry with a pending team_manager contact', async () => {
    const tournament = must(await adminClient
      .from('tournaments')
      .insert({ name: 'RLS External Entry Cup', org_id: orgA.id, slug: `rls-ext-${crypto.randomUUID().slice(0, 8)}` })
      .select().single(), 'tournaments external');
    tournamentId = tournament.id;

    const entry = must(await adminClient
      .from('tournament_entries')
      .insert({
        tournament_id: tournamentId,
        host_org_id: orgA.id,
        entrant_org_id: orgA.id,
        team_name: 'A Visiting Team',
        status: 'accepted',
      })
      .select().single(), 'tournament_entries external');
    entryId = entry.id;

    const contact = must(await adminClient.from('tournament_entry_contacts').insert({
      entry_id: entryId, org_id: orgA.id, name: 'External Manager', email: externalEmail,
      role: 'team_manager', account_status: 'invited', invited_at: new Date().toISOString(),
    }).select().single(), 'tournament_entry_contacts external');
    contactId = contact.id;

    externalUser = await createTestUser(externalEmail, 'audience');
    externalClient = await signInAs(externalEmail);
  });

  it('the invited contact can see their own invite row', async () => {
    const { data, error } = await externalClient.from('tournament_entry_contacts').select('id, account_status').eq('id', contactId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('a DIFFERENT signed-in user cannot see or claim it', async () => {
    const { data } = await coachA1Client.from('tournament_entry_contacts').select('id').eq('id', contactId);
    expect(data ?? []).toHaveLength(0);

    const { error: updateError, count } = await coachA1Client
      .from('tournament_entry_contacts')
      .update({ user_id: coachA1UserId, account_status: 'active' }, { count: 'exact' })
      .eq('id', contactId);
    expect(updateError).toBeNull();
    expect(count).toBe(0);
  });

  it('the matching-email contact CAN self-claim', async () => {
    const { error } = await externalClient
      .from('tournament_entry_contacts')
      .update({ user_id: externalUser.publicUser.id, account_status: 'active' })
      .eq('id', contactId);
    expect(error).toBeNull();

    const row = must(await adminClient.from('tournament_entry_contacts').select('account_status, user_id').eq('id', contactId).single(), 'contact after claim');
    expect(row.account_status).toBe('active');
    expect(row.user_id).toBe(externalUser.publicUser.id);
  });

  it('is_tournament_entry_contact recognizes the claimed contact, entry-scoped only', async () => {
    const { data: ownEntry } = await externalClient.rpc('is_tournament_entry_contact', { p_entry_id: entryId, min_role: 'team_manager' });
    expect(ownEntry).toBe(true);
    const { data: otherEntry } = await externalClient.rpc('is_tournament_entry_contact', { p_entry_id: crypto.randomUUID() });
    expect(otherEntry).toBe(false);
  });

  it('cleans up', async () => {
    await adminClient.from('tournament_entry_contacts').delete().eq('id', contactId);
    await adminClient.from('tournament_entries').delete().eq('id', entryId);
    await adminClient.from('tournaments').delete().eq('id', tournamentId);
    await adminClient.auth.admin.deleteUser(externalUser.publicUser.id);
  });
});

/**
 * Platform-scoped cross-org troubleshooting (gap analysis 2026-09-11, §1.2:
 * "the backdoor for all orgs when troubleshooting"). Every existing view-as
 * mechanism before this was entitlement-scoped -- club_it_admin's
 * start_impersonation() needs a club_id, tournament_it_admin has its own
 * separate one -- and neither reaches a Tournament-only org, which has no
 * club at all. This is a third, wider tier: org-scoped, platform-admin-only,
 * spanning both club and tournament relationships in one readout. It does
 * NOT replace or widen the other two -- club_it_admin and tournament_it_admin
 * keep working exactly as before, unchanged.
 */
describe('platform_impersonation (cross-org troubleshooting)', () => {
  const platformAdminEmail = `rls-platform-admin-${crypto.randomUUID().slice(0, 8)}@rls-test.local`;
  let platformAdminUserId: string;
  let platformAdminClient: ReturnType<typeof createClient>;

  it('sets up a platform admin', async () => {
    const admin = await createTestUser(platformAdminEmail, 'platform_admin');
    platformAdminUserId = admin.publicUser.id;
    must(await adminClient.from('platform_admins').insert({ email: platformAdminEmail }).select().single(), 'platform_admins insert');
    platformAdminClient = await signInAs(platformAdminEmail);
  });

  it('a non-admin (even an org_admin) CANNOT start a platform view-as session', async () => {
    const { error } = await orgAdminAClient.rpc('start_platform_impersonation', {
      p_org_id: orgA.id, p_target_user_id: coachA1UserId, p_reason: 'not authorized',
    });
    expect(error).not.toBeNull();
  });

  it('the platform admin is refused against a user with no relationship to the org', async () => {
    const { error } = await platformAdminClient.rpc('start_platform_impersonation', {
      p_org_id: orgB.id, p_target_user_id: coachA1UserId, p_reason: 'coach A1 is not in org B',
    });
    expect(error).not.toBeNull();
  });

  it('the platform admin CAN start a session against a real club_staff member, spanning both entitlements', async () => {
    const { data: sessionId, error } = await platformAdminClient.rpc('start_platform_impersonation', {
      p_org_id: orgA.id, p_target_user_id: coachA1UserId, p_reason: 'RLS smoke test',
    });
    expect(error).toBeNull();
    expect(sessionId).toBeTruthy();

    const { data: readout, error: readoutError } = await platformAdminClient.rpc('effective_access_for_platform', {
      p_target_user_id: coachA1UserId, p_org_id: orgA.id,
    });
    expect(readoutError).toBeNull();
    const clubMemberships = (readout as any).club_memberships as any[];
    expect(clubMemberships).toHaveLength(1);
    expect(clubMemberships[0].role).toBe('coach');
    expect((readout as any).entitlements).toEqual(expect.arrayContaining(['club']));
  });

  it('the audit trail attributes the action to the platform admin, never the target', async () => {
    const row = must(await adminClient
      .from('audit_log')
      .select('actor_email')
      .eq('action', 'security.platform_impersonation.started')
      .eq('entity_id', coachA1UserId)
      .order('ts', { ascending: false })
      .limit(1)
      .single(), 'audit row for platform impersonation start');
    expect(row.actor_email).toBe(platformAdminEmail);
  });

  it('org_people_directory is platform-admin only', async () => {
    const { data } = await coachA1Client.rpc('org_people_directory', { p_org_id: orgA.id });
    expect(data ?? []).toHaveLength(0);

    const { data: asAdmin, error } = await platformAdminClient.rpc('org_people_directory', { p_org_id: orgA.id });
    expect(error).toBeNull();
    expect((asAdmin ?? []).length).toBeGreaterThan(0);
  });

  it('ending the session locks the readout back out', async () => {
    const { data } = await platformAdminClient.rpc('my_active_platform_impersonation');
    const active = (data ?? [])[0] as any;
    expect(active).toBeTruthy();
    const { error: endError } = await platformAdminClient.rpc('end_platform_impersonation', { p_session_id: active.session_id });
    expect(endError).toBeNull();

    const { error: readoutError } = await platformAdminClient.rpc('effective_access_for_platform', {
      p_target_user_id: coachA1UserId, p_org_id: orgA.id,
    });
    expect(readoutError).not.toBeNull();
  });

  it('cleans up', async () => {
    await adminClient.from('platform_impersonation_sessions').delete().eq('actor_user_id', platformAdminUserId);
    await adminClient.from('platform_admins').delete().eq('email', platformAdminEmail);
    await adminClient.auth.admin.deleteUser(platformAdminUserId);
  });
});

/**
 * Org suspension (gap analysis 2026-09-11, Platform 1.1). organizations.status
 * used to be written by the console's Suspend button and read by nothing, so a
 * "suspended" org kept every permission. Two enforcement layers, both pinned:
 * RLS (a restrictive policy on every org_id table) and the permission helpers
 * (which SECURITY DEFINER RPCs authorize through, and which RLS never sees).
 */
describe('org suspension (phase9a)', () => {
  const paEmail = `rls-susp-pa-${crypto.randomUUID().slice(0, 8)}@rls-test.local`;
  let paUserId: string;
  let paClient: ReturnType<typeof createClient>;

  it('every org_id table is fenced, or explicitly exempt -- a new table cannot slip in unfenced', async () => {
    const { data, error } = await adminClient.rpc('org_tables_missing_suspension_fence');
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it('sets up a platform admin', async () => {
    const pa = await createTestUser(paEmail, 'platform_admin');
    paUserId = pa.publicUser.id;
    must(await adminClient.from('platform_admins').insert({ email: paEmail }).select().single(), 'platform_admins insert');
    paClient = await signInAs(paEmail);
  });

  it('baseline: an active org works for its coach and club manager', async () => {
    // view_player is team-scoped, so it needs the team the coach is assigned to.
    const perm = await coachA1Client.rpc('has_staff_permission', { p_permission_key: 'view_player', p_club_id: clubA.id, p_team_id: teamA1.id });
    expect(perm.data).toBe(true);
    const { data: teams } = await coachA1Client.from('teams').select('id').eq('id', teamA1.id);
    expect(teams).toHaveLength(1);
    const { data: staff } = await clubAdminAClient.rpc('club_staff_directory', { p_club_id: clubA.id });
    expect((staff ?? []).length).toBeGreaterThan(0);
  });

  it('a suspended org refuses its members on RLS paths, helper paths and RPC paths -- but not Platform Admin', async () => {
    must(await adminClient.from('organizations').update({ status: 'suspended' }).eq('id', orgA.id).select().single(), 'suspend orgA');
    try {
      // helper paths
      const perm = await coachA1Client.rpc('has_staff_permission', { p_permission_key: 'view_player', p_club_id: clubA.id, p_team_id: teamA1.id });
      expect(perm.data).toBe(false);
      expect((await coachA1Client.rpc('is_org_member', { org: orgA.id })).data).toBe(false);
      expect((await clubAdminAClient.rpc('is_club_manager', { check_club_id: clubA.id })).data).toBe(false);
      expect((await orgAdminAClient.rpc('is_org_admin', { org: orgA.id })).data).toBe(false);

      // RLS path (direct table read)
      const { data: teams } = await coachA1Client.from('teams').select('id').eq('id', teamA1.id);
      expect(teams ?? []).toHaveLength(0);

      // RPC path: SECURITY DEFINER bypasses RLS, so only the helper guard stops
      // it. A privileged write, refused for the club manager while suspended.
      const promote = await clubAdminAClient.rpc('set_team_primary_coach', { p_team_id: teamA1.id, p_user_id: coachA1UserId });
      expect(promote.error).not.toBeNull();

      // members are told why everything went empty; Platform Admin is not
      const { data: notice } = await coachA1Client.rpc('my_suspended_orgs');
      expect((notice ?? []).map((o: any) => o.org_id)).toContain(orgA.id);

      // Platform Admin still sees and can operate on the suspended org
      const { data: paTeams } = await paClient.from('teams').select('id').eq('id', teamA1.id);
      expect(paTeams).toHaveLength(1);
      const { data: paNotice } = await paClient.rpc('my_suspended_orgs');
      expect(paNotice ?? []).toHaveLength(0);
    } finally {
      await adminClient.from('organizations').update({ status: 'active' }).eq('id', orgA.id);
    }
  });

  it('reactivating restores access immediately', async () => {
    const perm = await coachA1Client.rpc('has_staff_permission', { p_permission_key: 'view_player', p_club_id: clubA.id, p_team_id: teamA1.id });
    expect(perm.data).toBe(true);
    const { data: teams } = await coachA1Client.from('teams').select('id').eq('id', teamA1.id);
    expect(teams).toHaveLength(1);
  });

  it('cleans up', async () => {
    await adminClient.from('organizations').update({ status: 'active' }).eq('id', orgA.id);
    await adminClient.from('platform_admins').delete().eq('email', paEmail);
    await adminClient.auth.admin.deleteUser(paUserId);
  });
});

/**
 * Clubs 2.3: `treasurer` -- created in phase6l as the finance specialist --
 * could not open the club Finances tab (a role-literal check) and, once that
 * was cut over to the permission catalog, still could not record an expense
 * because expenses RLS was can_admin_club only. phase9b aligns expenses with
 * how fee_charges/payments already honour manage_finances/view_finances.
 */
describe('expenses honour finance permissions (phase9b)', () => {
  const treasurerEmail = `rls-treasurer-${crypto.randomUUID().slice(0, 8)}@rls-test.local`;
  let treasurerUserId: string;
  let treasurerClient: ReturnType<typeof createClient>;
  const marker = `rls-expense-${crypto.randomUUID().slice(0, 8)}`;

  it('sets up a treasurer at club A', async () => {
    const t = await createTestUser(treasurerEmail, 'audience');
    treasurerUserId = t.publicUser.id;
    must(await adminClient.from('club_staff').insert({ club_id: clubA.id, user_id: treasurerUserId, role: 'treasurer' }).select().single(), 'club_staff treasurer');
    treasurerClient = await signInAs(treasurerEmail);
  });

  it('the treasurer holds view_finances and manage_finances', async () => {
    expect((await treasurerClient.rpc('has_staff_permission', { p_permission_key: 'view_finances', p_club_id: clubA.id })).data).toBe(true);
    expect((await treasurerClient.rpc('has_staff_permission', { p_permission_key: 'manage_finances', p_club_id: clubA.id })).data).toBe(true);
  });

  it('the treasurer CAN record and read an expense', async () => {
    const { error } = await treasurerClient.from('expenses').insert({
      club_id: clubA.id, org_id: orgA.id, description: marker, category: 'other', amount: 10,
    });
    expect(error).toBeNull();
    const { data } = await treasurerClient.from('expenses').select('id').eq('description', marker);
    expect(data).toHaveLength(1);
  });

  it('a coach CANNOT record or read expenses (no finance permission)', async () => {
    const { error } = await coachA1Client.from('expenses').insert({
      club_id: clubA.id, org_id: orgA.id, description: `${marker}-coach`, category: 'other', amount: 1,
    });
    expect(error).not.toBeNull();
    const { data } = await coachA1Client.from('expenses').select('id').eq('description', marker);
    expect(data ?? []).toHaveLength(0);
  });

  it('cleans up', async () => {
    await adminClient.from('expenses').delete().eq('club_id', clubA.id).like('description', `${marker}%`);
    await adminClient.from('club_staff').delete().eq('user_id', treasurerUserId);
    await adminClient.auth.admin.deleteUser(treasurerUserId);
  });
});

/**
 * Billing had a unit test for invoice arithmetic and no RLS test at all
 * (gap analysis cross-cutting risk): nothing proved the read narrowing was
 * deliberate rather than quietly reverting. Also pins phase9c -- tournament
 * billing authorizing on the existing manage_tournament_finances key instead
 * of is_org_admin alone -- and phase9d, the payer regression.
 */
describe('billing access (narrowed reads, payer access, tournament finance permission)', () => {
  let clubAccountId: string;
  let clubInvoiceId: string;
  let tournamentId: string;
  let tournamentAccountId: string;
  const tournamentInvoiceIds: string[] = [];

  it('sets up a club invoice payable by coach A1', async () => {
    const account = must(await adminClient.from('billing_accounts').select('id').eq('club_id', clubA.id).eq('context_type', 'club').single(), 'club billing account');
    clubAccountId = account.id;
    const { data, error } = await clubAdminAClient.rpc('create_billing_invoice', {
      p_org_id: orgA.id, p_billing_account_id: clubAccountId, p_context_type: 'club', p_payer_type: 'guardian',
      p_payer_user_id: coachA1UserId, p_lines: [{ description: 'RLS test fee', unit_amount: 25 }],
    });
    expect(error).toBeNull();
    clubInvoiceId = data as unknown as string;
  });

  it('a coach without finance permission CANNOT create a club invoice', async () => {
    const { error } = await coachA1Client.rpc('create_billing_invoice', {
      p_org_id: orgA.id, p_billing_account_id: clubAccountId, p_context_type: 'club', p_payer_type: 'guardian',
      p_lines: [{ description: 'nope', unit_amount: 1 }],
    });
    expect(error).not.toBeNull();
  });

  it('the payer reads their own invoice AND its account (for the payment instructions)', async () => {
    const { data: inv } = await coachA1Client.from('billing_invoices').select('id').eq('id', clubInvoiceId);
    expect(inv).toHaveLength(1);
    const { data: acct } = await coachA1Client.from('billing_accounts').select('id').eq('id', clubAccountId);
    expect(acct).toHaveLength(1);
  });

  it('another org member (not the payer, no finance permission) reads neither', async () => {
    const { data: inv } = await teamManagerA1Client.from('billing_invoices').select('id').eq('id', clubInvoiceId);
    expect(inv ?? []).toHaveLength(0);
    const { data: acct } = await teamManagerA1Client.from('billing_accounts').select('id').eq('id', clubAccountId);
    expect(acct ?? []).toHaveLength(0);
  });

  it('the club manager (holds manage_finances) reads both', async () => {
    const { data: inv } = await clubAdminAClient.from('billing_invoices').select('id').eq('id', clubInvoiceId);
    expect(inv).toHaveLength(1);
    const { data: acct } = await clubAdminAClient.from('billing_accounts').select('id').eq('id', clubAccountId);
    expect(acct).toHaveLength(1);
  });

  it('a tournament treasurer CAN create a tournament invoice via manage_tournament_finances; a non-staff coach cannot', async () => {
    const tournament = must(await adminClient.from('tournaments')
      .insert({ name: 'RLS Billing Cup', org_id: orgA.id, slug: `rls-bill-${crypto.randomUUID().slice(0, 8)}` }).select().single(), 'tournament');
    tournamentId = tournament.id;
    const account = must(await adminClient.from('billing_accounts').select('id').eq('tournament_id', tournamentId).eq('context_type', 'tournament').single(), 'tournament billing account (trigger)');
    tournamentAccountId = account.id;
    must(await adminClient.from('tournament_staff').insert({ tournament_id: tournamentId, user_id: teamManagerA1UserId, role: 'treasurer', org_id: orgA.id }).select().single(), 'tournament treasurer');

    const args = {
      p_org_id: orgA.id, p_billing_account_id: tournamentAccountId, p_context_type: 'tournament', p_payer_type: 'team',
      p_payer_label: 'RLS Team', p_lines: [{ description: 'entry fee', unit_amount: 100 }],
    };
    const allowed = await teamManagerA1Client.rpc('create_billing_invoice', args);
    expect(allowed.error).toBeNull();
    tournamentInvoiceIds.push(allowed.data as unknown as string);

    const refused = await coachA1Client.rpc('create_billing_invoice', args);
    expect(refused.error).not.toBeNull();
  });

  it('an org admin who is NOT tournament staff can read the tournament billing account and invoice they are allowed to create', async () => {
    // create_billing_invoice / can_review_billing_invoice accept is_org_admin
    // for tournament billing, so the read side has to as well -- it didn't,
    // and the organizer console's "issue entry-fee invoice" step found out.
    const { data: acct } = await orgAdminAClient.from('billing_accounts').select('id').eq('id', tournamentAccountId);
    expect(acct).toHaveLength(1);
    const { data: inv } = await orgAdminAClient.from('billing_invoices').select('id').eq('id', tournamentInvoiceIds[0]);
    expect(inv).toHaveLength(1);
  });

  it('cleans up', async () => {
    await adminClient.from('billing_invoices').delete().in('id', [clubInvoiceId, ...tournamentInvoiceIds].filter(Boolean));
    if (tournamentId) {
      await adminClient.from('tournament_staff').delete().eq('tournament_id', tournamentId);
      await adminClient.from('tournaments').delete().eq('id', tournamentId);
    }
  });
});

/**
 * Tournament organizer console (docs/tournament-organizer-console-proposal.md).
 * The tournament authorization layer existed with no UI, and checking what a
 * console would actually need turned up that an Organizer who is not also an
 * org admin could not READ the entries and categories they are meant to
 * decide: those tables read through is_org_member, which has no
 * tournament-staff branch. These tests use users with NO org membership at
 * all, so passing them proves the new tournament-staff policies rather than
 * the old org-member ones.
 */
describe('tournament organizer console (phase10a)', () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const organizerEmail = `rls-organizer-${suffix}@rls-test.local`;
  const treasurerEmail = `rls-tr-${suffix}@rls-test.local`;
  const newStaffEmail = `rls-newstaff-${suffix}@rls-test.local`;
  let organizerId: string;
  let treasurerId: string;
  let newStaffId: string;
  let organizerClient: ReturnType<typeof createClient>;
  let treasurerClient: ReturnType<typeof createClient>;
  let tournamentId: string;
  let categoryId: string;
  let entryId: string;

  it('sets up a tournament with an organizer and a treasurer who belong to no org', async () => {
    organizerId = (await createTestUser(organizerEmail, 'audience')).publicUser.id;
    treasurerId = (await createTestUser(treasurerEmail, 'audience')).publicUser.id;
    newStaffId = (await createTestUser(newStaffEmail, 'audience')).publicUser.id;
    const tournament = must(await adminClient.from('tournaments')
      .insert({ name: 'RLS Organizer Cup', org_id: orgA.id, slug: `rls-org-${suffix}` }).select().single(), 'tournament');
    tournamentId = tournament.id;
    must(await adminClient.from('tournament_staff').insert([
      { tournament_id: tournamentId, user_id: organizerId, role: 'organizer', org_id: orgA.id },
      { tournament_id: tournamentId, user_id: treasurerId, role: 'treasurer', org_id: orgA.id },
    ]).select(), 'tournament_staff');
    organizerClient = await signInAs(organizerEmail);
    treasurerClient = await signInAs(treasurerEmail);
  });

  it('tournament staff can read the tournament row; someone from another org cannot', async () => {
    expect((await organizerClient.from('tournaments').select('id').eq('id', tournamentId)).data).toHaveLength(1);
    expect((await treasurerClient.from('tournaments').select('id').eq('id', tournamentId)).data).toHaveLength(1);
    expect((await clubStaffBClient.from('tournaments').select('id').eq('id', tournamentId)).data ?? []).toHaveLength(0);
  });

  it('the organizer can create a category with a fee and capacity; the treasurer cannot', async () => {
    const { data, error } = await organizerClient.from('tournament_categories')
      .insert({ org_id: orgA.id, tournament_id: tournamentId, name: 'U15 Boys', entry_fee: 1500, capacity: 8 }).select('id').single();
    expect(error).toBeNull();
    categoryId = data!.id;

    const refused = await treasurerClient.from('tournament_categories')
      .insert({ org_id: orgA.id, tournament_id: tournamentId, name: 'Nope' });
    expect(refused.error).not.toBeNull();

    expect((await treasurerClient.from('tournament_categories').select('id').eq('id', categoryId)).data).toHaveLength(1);
    expect((await clubStaffBClient.from('tournament_categories').select('id').eq('id', categoryId)).data ?? []).toHaveLength(0);
  });

  it('the organizer can add a PENDING entry, but not one that is already accepted, forged onto another host org, or in a foreign category', async () => {
    const base = { tournament_id: tournamentId, host_org_id: orgA.id, category_id: categoryId, team_name: 'Visitors FC' };

    const accepted = await organizerClient.from('tournament_entries').insert({ ...base, status: 'accepted' });
    expect(accepted.error).not.toBeNull(); // acceptance goes through decide_tournament_entry, which audits

    const forged = await organizerClient.from('tournament_entries').insert({ ...base, host_org_id: orgB.id, status: 'pending' });
    expect(forged.error).not.toBeNull();

    const { data, error } = await organizerClient.from('tournament_entries').insert({ ...base, status: 'pending' }).select('id').single();
    expect(error).toBeNull();
    entryId = data!.id;

    const byTreasurer = await treasurerClient.from('tournament_entries').insert({ ...base, team_name: 'No', status: 'pending' });
    expect(byTreasurer.error).not.toBeNull();
  });

  it('staff can read entries; another org cannot', async () => {
    expect((await organizerClient.from('tournament_entries').select('id').eq('id', entryId)).data).toHaveLength(1);
    expect((await treasurerClient.from('tournament_entries').select('id').eq('id', entryId)).data).toHaveLength(1);
    expect((await clubStaffBClient.from('tournament_entries').select('id').eq('id', entryId)).data ?? []).toHaveLength(0);
  });

  it('entry contacts: the organizer can add one, the treasurer cannot, and org_id cannot be forged', async () => {
    const contact = { entry_id: entryId, name: 'Coach Reyes', email: `rls-contact-${suffix}@rls-test.local`, role: 'team_manager' };
    const ok = await organizerClient.from('tournament_entry_contacts').insert({ ...contact, org_id: orgA.id }).select('id').single();
    expect(ok.error).toBeNull();
    expect((await treasurerClient.from('tournament_entry_contacts').insert({ ...contact, org_id: orgA.id })).error).not.toBeNull();
    expect((await organizerClient.from('tournament_entry_contacts').insert({ ...contact, org_id: orgB.id })).error).not.toBeNull();
  });

  it('the organizer decides the entry via the audited RPC; the treasurer cannot', async () => {
    expect((await treasurerClient.rpc('decide_tournament_entry', { p_entry_id: entryId, p_status: 'accepted' })).error).not.toBeNull();
    expect((await organizerClient.rpc('decide_tournament_entry', { p_entry_id: entryId, p_status: 'accepted' })).error).toBeNull();
    const row = must(await adminClient.from('tournament_entries').select('status').eq('id', entryId).single(), 'entry status');
    expect(row.status).toBe('accepted');
  });

  it('add_tournament_staff: the organizer can add an existing account by email; unknown emails and non-managers are refused', async () => {
    const ok = await organizerClient.rpc('add_tournament_staff', { p_tournament_id: tournamentId, p_email: newStaffEmail, p_role: 'team_coordinator' });
    expect(ok.error).toBeNull();
    const row = must(await adminClient.from('tournament_staff').select('role, status').eq('tournament_id', tournamentId).eq('user_id', newStaffId).single(), 'new staff row');
    expect(row).toMatchObject({ role: 'team_coordinator', status: 'active' });

    expect((await organizerClient.rpc('add_tournament_staff', { p_tournament_id: tournamentId, p_email: 'nobody-here@rls-test.local', p_role: 'logistics' })).error).not.toBeNull();
    expect((await treasurerClient.rpc('add_tournament_staff', { p_tournament_id: tournamentId, p_email: newStaffEmail, p_role: 'logistics' })).error).not.toBeNull();
  });

  it('an org admin who is not tournament staff sees the audit trail and can suspend staff; a treasurer sees no audit rows', async () => {
    const audit = await orgAdminAClient.rpc('tournament_audit_log', { p_tournament_id: tournamentId });
    expect((audit.data ?? []).length).toBeGreaterThan(0); // the accepted decision above wrote one
    const blind = await treasurerClient.rpc('tournament_audit_log', { p_tournament_id: tournamentId });
    expect(blind.data ?? []).toHaveLength(0);

    expect((await orgAdminAClient.rpc('set_tournament_staff_account_status', { p_tournament_id: tournamentId, p_target_user_id: treasurerId, p_status: 'suspended' })).error).toBeNull();
    expect((await orgAdminAClient.rpc('set_tournament_staff_account_status', { p_tournament_id: tournamentId, p_target_user_id: treasurerId, p_status: 'active' })).error).toBeNull();
  });

  it('my_manageable_tournaments lists a tournament for its staff and not for another org', async () => {
    const mine = await organizerClient.rpc('my_manageable_tournaments');
    expect((mine.data ?? []).map((t: any) => t.tournament_id)).toContain(tournamentId);
    const theirs = await clubStaffBClient.rpc('my_manageable_tournaments');
    expect((theirs.data ?? []).map((t: any) => t.tournament_id)).not.toContain(tournamentId);
  });

  it('cleans up', async () => {
    await adminClient.from('tournament_entry_contacts').delete().eq('entry_id', entryId);
    await adminClient.from('tournament_entries').delete().eq('tournament_id', tournamentId);
    await adminClient.from('tournament_categories').delete().eq('tournament_id', tournamentId);
    await adminClient.from('tournament_staff').delete().eq('tournament_id', tournamentId);
    await adminClient.from('tournaments').delete().eq('id', tournamentId);
    for (const id of [organizerId, treasurerId, newStaffId]) await adminClient.auth.admin.deleteUser(id);
  });
});

/**
 * write_audit() used to have no authorization: any signed-in user could write
 * an audit row into any org. phase11a moved the unchecked body to
 * write_audit_system (only reachable from inside SECURITY DEFINER functions)
 * and made the client-callable write_audit() require a real relationship.
 * The 17 definer functions that audit as a side effect (port, decide entry,
 * billing, impersonation…) are covered by the suites above still passing —
 * they now call write_audit_system, and a cross-org write there is legitimate.
 */
describe('write_audit requires a relationship to the org (phase11a)', () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const platformAdminEmail = `rls-audit-pa-${suffix}@rls-test.local`;
  let platformAdminClient: ReturnType<typeof createClient>;
  let platformAdminId: string;
  const action = `rls-test.audit-${suffix}`;

  it('sets up a platform admin', async () => {
    platformAdminId = (await createTestUser(platformAdminEmail, 'platform_admin')).publicUser.id;
    must(await adminClient.from('platform_admins').insert({ email: platformAdminEmail }).select().single(), 'platform_admins insert');
    platformAdminClient = await signInAs(platformAdminEmail);
  });

  it('a member of an org CAN write an audit row for it, attributed to themselves', async () => {
    const { data, error } = await coachA1Client.rpc('write_audit', { p_org_id: orgA.id, p_action: action, p_scope_type: 'club', p_scope_id: clubA.id });
    expect(error).toBeNull();
    expect(typeof data).toBe('number');
    const { data: row } = await adminClient.from('audit_log').select('actor_user_id, org_id').eq('id', data as number).single();
    expect(row).toMatchObject({ actor_user_id: coachA1UserId, org_id: orgA.id });
  });

  it('a user CANNOT write an audit row into an org they have no relationship to', async () => {
    const { error } = await coachA1Client.rpc('write_audit', { p_org_id: orgB.id, p_action: action });
    expect(error).not.toBeNull();
    const { data } = await adminClient.from('audit_log').select('id').eq('org_id', orgB.id).eq('action', action);
    expect(data ?? []).toHaveLength(0);
  });

  it('a null org (system-wide row) is refused to an ordinary user', async () => {
    const { error } = await clubAdminAClient.rpc('write_audit', { p_org_id: null as any, p_action: action });
    expect(error).not.toBeNull();
  });

  it('anon is refused', async () => {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { error } = await anonClient.rpc('write_audit', { p_org_id: orgA.id, p_action: action });
    expect(error).not.toBeNull();
  });

  it('a platform admin CAN write into any org, and a null org', async () => {
    expect((await platformAdminClient.rpc('write_audit', { p_org_id: orgB.id, p_action: action })).error).toBeNull();
    expect((await platformAdminClient.rpc('write_audit', { p_org_id: null as any, p_action: action })).error).toBeNull();
  });

  it('write_audit_system is not callable by a signed-in user, even for their own org', async () => {
    const { error } = await coachA1Client.rpc('write_audit_system', { p_org_id: orgA.id, p_action: action });
    expect(error).not.toBeNull();
  });

  it('the service role can still write (seed scripts and fixtures rely on it)', async () => {
    expect((await adminClient.rpc('write_audit', { p_org_id: orgA.id, p_action: action })).error).toBeNull();
    expect((await adminClient.rpc('write_audit_system', { p_org_id: orgA.id, p_action: action })).error).toBeNull();
  });

  it('cleans up', async () => {
    // audit_log is append-only for everyone except the service role, which is fine for fixtures
    await adminClient.from('audit_log').delete().eq('action', action);
    await adminClient.from('platform_admins').delete().eq('email', platformAdminEmail);
    await adminClient.auth.admin.deleteUser(platformAdminId);
  });
});

/**
 * Tournament finance queue (docs/tournament-organizer-console-proposal.md,
 * slice 5). review_billing_payment already let a finance holder verify a
 * SUBMITTED payment, but an entry billed by the host is usually paid in cash or
 * by a transfer the host sees on their own bank statement -- nothing was ever
 * submitted -- so the host needs to record it themselves. And the payment
 * instructions payers read were editable by Platform Admin only.
 */
describe('tournament finance queue (phase11b)', () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const treasurerEmail = `rls-fq-tr-${suffix}@rls-test.local`;
  let treasurerId: string;
  let treasurerClient: ReturnType<typeof createClient>;
  let tournamentId: string;
  let accountId: string;
  let invoiceId: string;
  let secondInvoiceId: string;
  let thirdInvoiceId: string;

  const invoiceArgs = (amount: number) => ({
    p_org_id: orgA.id, p_billing_account_id: accountId, p_context_type: 'tournament', p_payer_type: 'team',
    p_payer_label: 'RLS Finance Team', p_lines: [{ description: 'entry fee', unit_amount: amount }],
  });

  it('sets up a tournament with a treasurer who belongs to no org, and a 100.00 invoice', async () => {
    treasurerId = (await createTestUser(treasurerEmail, 'audience')).publicUser.id;
    const tournament = must(await adminClient.from('tournaments')
      .insert({ name: 'RLS Finance Cup', org_id: orgA.id, slug: `rls-fq-${suffix}` }).select().single(), 'tournament');
    tournamentId = tournament.id;
    accountId = must(await adminClient.from('billing_accounts').select('id').eq('tournament_id', tournamentId).eq('context_type', 'tournament').single(), 'account').id;
    must(await adminClient.from('tournament_staff').insert({ tournament_id: tournamentId, user_id: treasurerId, role: 'treasurer', org_id: orgA.id }).select().single(), 'staff');
    treasurerClient = await signInAs(treasurerEmail);
    const { data, error } = await treasurerClient.rpc('create_billing_invoice', invoiceArgs(100));
    expect(error).toBeNull();
    invoiceId = data as unknown as string;
  });

  it('a treasurer CAN record a partial cash payment; the invoice becomes partially_paid', async () => {
    const { data, error } = await treasurerClient.rpc('record_billing_payment', {
      p_invoice_id: invoiceId, p_amount: 40, p_method: 'cash', p_reference_number: 'OR-0001', p_note: 'paid at the desk',
    });
    expect(error).toBeNull();
    const submission = must(await adminClient.from('billing_payment_submissions').select('status, amount, reviewed_by, method').eq('id', data as string).single(), 'submission');
    expect(submission).toMatchObject({ status: 'verified', amount: 40, reviewed_by: treasurerId, method: 'cash' });
    const inv = must(await adminClient.from('billing_invoices').select('amount_paid, status').eq('id', invoiceId).single(), 'invoice');
    expect(inv).toMatchObject({ amount_paid: 40, status: 'partially_paid' });
  });

  it('cannot record more than the remaining balance, a non-positive amount, or an unknown method', async () => {
    expect((await treasurerClient.rpc('record_billing_payment', { p_invoice_id: invoiceId, p_amount: 70, p_method: 'cash' })).error).not.toBeNull();
    expect((await treasurerClient.rpc('record_billing_payment', { p_invoice_id: invoiceId, p_amount: 0, p_method: 'cash' })).error).not.toBeNull();
    expect((await treasurerClient.rpc('record_billing_payment', { p_invoice_id: invoiceId, p_amount: 10, p_method: 'bitcoin' })).error).not.toBeNull();
    const inv = must(await adminClient.from('billing_invoices').select('amount_paid').eq('id', invoiceId).single(), 'invoice');
    expect(inv.amount_paid).toBe(40);
  });

  it('people without finance authority over this tournament are refused', async () => {
    // same-org coach with no tournament role, a user from a different org, and anon
    expect((await coachA1Client.rpc('record_billing_payment', { p_invoice_id: invoiceId, p_amount: 10, p_method: 'cash' })).error).not.toBeNull();
    expect((await clubStaffBClient.rpc('record_billing_payment', { p_invoice_id: invoiceId, p_amount: 10, p_method: 'cash' })).error).not.toBeNull();
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    expect((await anonClient.rpc('record_billing_payment', { p_invoice_id: invoiceId, p_amount: 10, p_method: 'cash' })).error).not.toBeNull();
  });

  it('an org admin who is not tournament staff CAN record a payment', async () => {
    const { error } = await orgAdminAClient.rpc('record_billing_payment', { p_invoice_id: invoiceId, p_amount: 10, p_method: 'bank_transfer' });
    expect(error).toBeNull();
  });

  it('recording the rest marks it paid, and a paid invoice takes no further payment', async () => {
    expect((await treasurerClient.rpc('record_billing_payment', { p_invoice_id: invoiceId, p_amount: 50, p_method: 'cash' })).error).toBeNull();
    const inv = must(await adminClient.from('billing_invoices').select('amount_paid, status').eq('id', invoiceId).single(), 'invoice');
    expect(inv).toMatchObject({ amount_paid: 100, status: 'paid' });
    expect((await treasurerClient.rpc('record_billing_payment', { p_invoice_id: invoiceId, p_amount: 1, p_method: 'cash' })).error).not.toBeNull();
  });

  it('every recorded payment left an audit row attributed to whoever recorded it', async () => {
    const { data } = await adminClient.from('audit_log').select('actor_user_id').eq('org_id', orgA.id).eq('action', 'billing.payment.recorded').eq('entity_type', 'billing_invoice').eq('entity_id', invoiceId);
    expect((data ?? []).length).toBe(3);
    expect((data ?? []).filter((r) => r.actor_user_id === treasurerId)).toHaveLength(2);
  });

  it('a treasurer CAN verify a payer-submitted payment (regression: review path untouched)', async () => {
    const created = await treasurerClient.rpc('create_billing_invoice', invoiceArgs(30));
    expect(created.error).toBeNull();
    secondInvoiceId = created.data as unknown as string;
    // any org member may submit on the org's behalf (submit_billing_payment)
    const submitted = await coachA1Client.rpc('submit_billing_payment', { p_invoice_id: secondInvoiceId, p_amount: 30, p_method: 'qr_transfer', p_reference_number: 'QR-77' });
    expect(submitted.error).toBeNull();
    expect((await coachA1Client.rpc('review_billing_payment', { p_payment_id: submitted.data as string, p_status: 'verified' })).error).not.toBeNull();
    expect((await treasurerClient.rpc('review_billing_payment', { p_payment_id: submitted.data as string, p_status: 'verified' })).error).toBeNull();
    const inv = must(await adminClient.from('billing_invoices').select('status').eq('id', secondInvoiceId).single(), 'invoice');
    expect(inv.status).toBe('paid');
  });

  it('rejecting the only pending payment puts the invoice back to payable, not stuck "submitted"', async () => {
    // review_billing_payment used to leave the invoice at submitted_for_verification
    // after a rejection: the Finance screen showed "payment submitted" with
    // nothing to verify. It must land on a status the payer's own page still
    // lists (awaiting_payment / partially_paid) -- NOT 'rejected', which that
    // page filters out, so the payer would lose sight of what they owe.
    const created = await treasurerClient.rpc('create_billing_invoice', invoiceArgs(50));
    expect(created.error).toBeNull();
    thirdInvoiceId = created.data as unknown as string;
    const status = async () => must(await adminClient.from('billing_invoices').select('status').eq('id', thirdInvoiceId).single(), 'invoice').status;

    const first = await coachA1Client.rpc('submit_billing_payment', { p_invoice_id: thirdInvoiceId, p_amount: 50, p_method: 'qr_transfer' });
    expect(first.error).toBeNull();
    expect(await status()).toBe('submitted_for_verification');
    expect((await treasurerClient.rpc('review_billing_payment', { p_payment_id: first.data as string, p_status: 'rejected', p_reviewer_note: 'wrong reference' })).error).toBeNull();
    expect(await status()).toBe('awaiting_payment');

    // with money already in, a rejection lands on partially_paid instead
    expect((await treasurerClient.rpc('record_billing_payment', { p_invoice_id: thirdInvoiceId, p_amount: 20, p_method: 'cash' })).error).toBeNull();
    const second = await coachA1Client.rpc('submit_billing_payment', { p_invoice_id: thirdInvoiceId, p_amount: 30, p_method: 'qr_transfer' });
    expect(second.error).toBeNull();
    expect((await treasurerClient.rpc('review_billing_payment', { p_payment_id: second.data as string, p_status: 'rejected', p_reviewer_note: 'not received' })).error).toBeNull();
    expect(await status()).toBe('partially_paid');

    // two live submissions: rejecting one must NOT clear the other's status
    const a = await coachA1Client.rpc('submit_billing_payment', { p_invoice_id: thirdInvoiceId, p_amount: 10, p_method: 'qr_transfer' });
    const b = await coachA1Client.rpc('submit_billing_payment', { p_invoice_id: thirdInvoiceId, p_amount: 20, p_method: 'qr_transfer' });
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect((await treasurerClient.rpc('review_billing_payment', { p_payment_id: a.data as string, p_status: 'rejected', p_reviewer_note: 'duplicate' })).error).toBeNull();
    expect(await status()).toBe('submitted_for_verification');
  });

  it('payment instructions for a TOURNAMENT account are editable by its finance holders and org admin, not by others', async () => {
    const text = 'GCash 0917 000 0000 -- RLS test';
    expect((await coachA1Client.rpc('update_billing_account_instructions', { p_account_id: accountId, p_payment_instructions: text })).error).not.toBeNull();
    expect((await clubStaffBClient.rpc('update_billing_account_instructions', { p_account_id: accountId, p_payment_instructions: text })).error).not.toBeNull();
    expect((await treasurerClient.rpc('update_billing_account_instructions', { p_account_id: accountId, p_payment_instructions: text })).error).toBeNull();
    expect(must(await adminClient.from('billing_accounts').select('payment_instructions').eq('id', accountId).single(), 'account').payment_instructions).toBe(text);
    expect((await orgAdminAClient.rpc('update_billing_account_instructions', { p_account_id: accountId, p_payment_instructions: 'set by org admin' })).error).toBeNull();
  });

  it('payment instructions for a CLUB account stay Platform-Admin-only', async () => {
    const clubAccount = must(await adminClient.from('billing_accounts').select('id').eq('club_id', clubA.id).eq('context_type', 'club').single(), 'club account');
    expect((await clubAdminAClient.rpc('update_billing_account_instructions', { p_account_id: clubAccount.id, p_payment_instructions: 'nope' })).error).not.toBeNull();
    expect((await orgAdminAClient.rpc('update_billing_account_instructions', { p_account_id: clubAccount.id, p_payment_instructions: 'nope' })).error).not.toBeNull();
  });

  it('cleans up', async () => {
    // billing_payment_allocations.invoice_id has no cascade: deleting an invoice
    // that took a payment fails silently and strands the whole fixture org,
    // which then breaks the NEXT run's beforeAll ("user already registered").
    const ids = [invoiceId, secondInvoiceId, thirdInvoiceId].filter(Boolean);
    await adminClient.from('billing_payment_allocations').delete().in('invoice_id', ids);
    await adminClient.from('billing_payment_submissions').delete().in('invoice_id', ids);
    await adminClient.from('billing_invoices').delete().in('id', ids);
    await adminClient.from('tournament_staff').delete().eq('tournament_id', tournamentId);
    await adminClient.from('tournaments').delete().eq('id', tournamentId);
    await adminClient.auth.admin.deleteUser(treasurerId);
  });
});

/**
 * The homepage shows club logos, so public_clubs now exposes logo_key (the R2
 * object key, which is only a path -- objects are private and the app signs a
 * URL) and org_logo_url (the fallback). Both must follow the view's existing
 * fence: only listed clubs of active orgs, and nothing else about a club that
 * opted out of the directory.
 */
describe('public directory logos (phase12a)', () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  let listedId: string;
  let privateId: string;
  let anonClient: ReturnType<typeof createClient>;

  it('sets up a listed club with a logo and a private club with one', async () => {
    anonClient = createClient(SUPABASE_URL, ANON_KEY);
    await adminClient.from('organizations').update({ logo_url: 'https://example.test/org-logo.png' }).eq('id', orgA.id);
    listedId = must(await adminClient.from('clubs').insert({
      name: 'RLS Listed Club', slug: `rls-listed-${suffix}`, org_id: orgA.id, publicly_listed: true,
      branding: { logoKey: `tenants/rls/branding/listed-${suffix}.png` },
    }).select('id').single(), 'listed club').id;
    privateId = must(await adminClient.from('clubs').insert({
      name: 'RLS Private Club', slug: `rls-private-${suffix}`, org_id: orgA.id, publicly_listed: false,
      branding: { logoKey: `tenants/rls/branding/private-${suffix}.png` },
    }).select('id').single(), 'private club').id;
  });

  it('anon sees the listed club logo key and its org logo', async () => {
    const { data, error } = await anonClient.from('public_clubs').select('slug, logo_key, org_logo_url').eq('slug', `rls-listed-${suffix}`);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].logo_key).toBe(`tenants/rls/branding/listed-${suffix}.png`);
    expect(data![0].org_logo_url).toBe('https://example.test/org-logo.png');
  });

  it('anon sees nothing of a club that is not publicly listed, logo key included', async () => {
    const { data } = await anonClient.from('public_clubs').select('slug, logo_key').eq('slug', `rls-private-${suffix}`);
    expect(data ?? []).toHaveLength(0);
    const all = await anonClient.from('public_clubs').select('logo_key');
    expect((all.data ?? []).map((r) => r.logo_key)).not.toContain(`tenants/rls/branding/private-${suffix}.png`);
  });

  it('a club with no logo reads as null (the app then draws a crest)', async () => {
    await adminClient.from('clubs').update({ branding: {} }).eq('id', listedId);
    const { data } = await anonClient.from('public_clubs').select('logo_key').eq('slug', `rls-listed-${suffix}`);
    expect(data).toHaveLength(1);
    expect(data![0].logo_key).toBeNull();
  });

  it('a suspended org drops out of the directory entirely', async () => {
    await adminClient.from('organizations').update({ status: 'suspended' }).eq('id', orgA.id);
    const { data } = await anonClient.from('public_clubs').select('slug').eq('slug', `rls-listed-${suffix}`);
    expect(data ?? []).toHaveLength(0);
    await adminClient.from('organizations').update({ status: 'active' }).eq('id', orgA.id);
  });

  it('anon still cannot write through the view', async () => {
    const { error } = await anonClient.from('public_clubs').update({ name: 'hijacked' }).eq('slug', `rls-listed-${suffix}`);
    expect(error).not.toBeNull();
  });

  it('cleans up', async () => {
    await adminClient.from('organizations').update({ status: 'active', logo_url: null }).eq('id', orgA.id);
    await adminClient.from('clubs').delete().in('id', [listedId, privateId].filter(Boolean));
  });
});

/**
 * The permission tables in docs/guides are generated from the live catalog
 * (npm run docs:permissions). If someone changes what a role can do and forgets
 * to regenerate, a guide would confidently describe the old role -- so this fails
 * until they do, the same idea as the anon-executable and org-fence guards.
 */
describe('how-to guide permission tables match the live catalog', () => {
  it('every generated table in docs/guides is current', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const { applyBlocks } = await import('../../scripts/lib/guide-permissions.mjs');

    const permissions = must(await adminClient.from('permissions').select('key, scope, label, description'), 'permissions');
    const roleDefaults = must(await adminClient.from('role_permission_defaults').select('role, permission_key'), 'role defaults');
    const guardianDefaults = must(await adminClient.from('guardian_permission_defaults').select('permission_key'), 'guardian defaults');
    const catalog = { permissions, roleDefaults, guardianDefaults };

    const dir = 'docs/guides';
    let tables = 0;
    const stale: string[] = [];
    for (const file of readdirSync(dir).filter((n: string) => n.endsWith('.md'))) {
      const { changed, blocks } = applyBlocks(readFileSync(`${dir}/${file}`, 'utf-8'), catalog);
      tables += blocks;
      if (changed) stale.push(file);
    }
    expect(stale, `out of date: ${stale.join(', ')} -- run "npm run docs:permissions"`).toEqual([]);
    // a guide folder with no tables at all would pass the check above by doing nothing
    expect(tables).toBeGreaterThan(0);
  });
});

/**
 * The club page used to hide "Add staff" from an org admin, so a newly created
 * club could never get its first club manager without a platform admin. The
 * database always allowed it (club_staff_write is can_admin_club, which includes
 * an org admin); the screen now matches. This pins the contract the screen relies
 * on, including who is still refused.
 */
describe("an org admin can staff a club they don't belong to (club page fix)", () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  let newHireId: string;
  let staffRowId: string;

  it('sets up a person with a login and no role at this club', async () => {
    newHireId = (await createTestUser(`rls-newhire-${suffix}@rls-test.local`, 'audience')).publicUser.id;
  });

  it('an org admin who is NOT club staff can add them as club manager', async () => {
    const { data, error } = await orgAdminAClient
      .from('club_staff')
      .insert({ club_id: clubA.id, user_id: newHireId, role: 'club_manager' })
      .select('id')
      .single();
    expect(error).toBeNull();
    staffRowId = data!.id;
  });

  it('that person is then a club manager of the club', async () => {
    const { data } = await adminClient.from('club_staff').select('role, status').eq('id', staffRowId).single();
    expect(data).toMatchObject({ role: 'club_manager', status: 'active' });
  });

  it('the org admin can archive them again (Remove archives rather than deletes)', async () => {
    const { data, error } = await orgAdminAClient.from('club_staff').update({ status: 'archived' }).eq('id', staffRowId).select('id');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('a coach at the club cannot add staff', async () => {
    const { error } = await coachA1Client.from('club_staff').insert({ club_id: clubA.id, user_id: newHireId, role: 'staff' });
    expect(error).not.toBeNull();
  });

  it("another organization's admin-level user cannot add staff to this club", async () => {
    const { error } = await clubStaffBClient.from('club_staff').insert({ club_id: clubA.id, user_id: newHireId, role: 'staff' });
    expect(error).not.toBeNull();
  });

  it('the org admin still cannot assign a PRIMARY coach (that function needs manage_staff, which an org admin does not hold)', async () => {
    const { error } = await orgAdminAClient.rpc('set_team_primary_coach', { p_team_id: teamA1.id, p_user_id: coachA1UserId });
    expect(error).not.toBeNull();
  });

  it('cleans up', async () => {
    await adminClient.from('club_staff').delete().eq('user_id', newHireId);
    await adminClient.from('audit_log').delete().eq('entity_id', newHireId);
    await adminClient.auth.admin.deleteUser(newHireId);
  });
});

/**
 * "Add staff" and "Link player login" both look a person up by email, and both did
 * it with a plain select on public.users. That table lets you read your own row,
 * a platform admin's view, and rows with a role_assignments entry in your org --
 * and role_assignments is empty -- so for everyone except a platform admin the
 * lookup found nothing and said "No existing Dula HQ account found" about people
 * who had one. Confirmed live as the real club manager. The fix is the pattern
 * add_tournament_staff already uses: a definer function that checks the caller's
 * authority FIRST and only then looks the email up, so the lookup isn't a way to
 * probe which emails have accounts.
 */
describe('adding staff and linking a player login by email (definer lookups)', () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  let userOne: string;
  let userTwo: string;
  let staffRowOne: string;
  const emailOne = `rls-hire1-${suffix}@rls-test.local`;
  const emailTwo = `rls-hire2-${suffix}@rls-test.local`;

  it('sets up two people who have a login and no role at this club', async () => {
    userOne = (await createTestUser(emailOne, 'audience')).publicUser.id;
    userTwo = (await createTestUser(emailTwo, 'audience')).publicUser.id;
  });

  describe('add_club_staff', () => {
    it('an org admin who is NOT club staff can add someone as club manager', async () => {
      const { data, error } = await orgAdminAClient.rpc('add_club_staff', { p_club_id: clubA.id, p_email: emailOne, p_role: 'club_manager' });
      expect(error).toBeNull();
      staffRowOne = data as unknown as string;
      const row = must(await adminClient.from('club_staff').select('role, status, user_id').eq('id', staffRowOne).single(), 'staff row');
      expect(row).toMatchObject({ role: 'club_manager', status: 'active', user_id: userOne });
    });

    it('a club manager can add someone (the case that was silently broken)', async () => {
      const { error } = await clubAdminAClient.rpc('add_club_staff', { p_club_id: clubA.id, p_email: emailTwo, p_role: 'coach' });
      expect(error).toBeNull();
    });

    it('the email is matched without regard to case or stray spaces', async () => {
      const { error } = await clubAdminAClient.rpc('add_club_staff', { p_club_id: clubA.id, p_email: `  ${emailTwo.toUpperCase()} `, p_role: 'assistant_coach' });
      expect(error).toBeNull();
    });

    it('adding is audited', async () => {
      const { data } = await adminClient.from('audit_log').select('action, scope_id').eq('entity_id', staffRowOne).eq('action', 'staff.added');
      expect(data).toHaveLength(1);
      expect(data![0].scope_id).toBe(clubA.id);
    });

    it('a coach, a guardian and another organization are all refused', async () => {
      for (const client of [coachA1Client, guardianOfA1Client, clubStaffBClient]) {
        const { error } = await client.rpc('add_club_staff', { p_club_id: clubA.id, p_email: emailOne, p_role: 'staff' });
        expect(error).not.toBeNull();
      }
      const anon = createClient(SUPABASE_URL, ANON_KEY);
      expect((await anon.rpc('add_club_staff', { p_club_id: clubA.id, p_email: emailOne, p_role: 'staff' })).error).not.toBeNull();
    });

    it('the refusal comes BEFORE the lookup, so it cannot be used to probe which emails have accounts', async () => {
      const real = await coachA1Client.rpc('add_club_staff', { p_club_id: clubA.id, p_email: emailOne, p_role: 'staff' });
      const fake = await coachA1Client.rpc('add_club_staff', { p_club_id: clubA.id, p_email: `nobody-${suffix}@rls-test.local`, p_role: 'staff' });
      expect(real.error?.message).toBe(fake.error?.message);
    });

    it('an email with no account says so, plainly', async () => {
      const { error } = await clubAdminAClient.rpc('add_club_staff', { p_club_id: clubA.id, p_email: `nobody-${suffix}@rls-test.local`, p_role: 'staff' });
      expect(error?.message).toMatch(/no dul(a|à) hq account/i);
    });

    it('adding the same person to the same role twice is refused; an unknown role is refused', async () => {
      expect((await clubAdminAClient.rpc('add_club_staff', { p_club_id: clubA.id, p_email: emailOne, p_role: 'club_manager' })).error).not.toBeNull();
      expect((await clubAdminAClient.rpc('add_club_staff', { p_club_id: clubA.id, p_email: emailOne, p_role: 'wizard' })).error).not.toBeNull();
    });

    it('re-adding someone who was archived restores the same row instead of failing', async () => {
      must(await adminClient.from('club_staff').update({ status: 'archived' }).eq('id', staffRowOne).select('id').single(), 'archive');
      const { data, error } = await orgAdminAClient.rpc('add_club_staff', { p_club_id: clubA.id, p_email: emailOne, p_role: 'club_manager' });
      expect(error).toBeNull();
      expect(data).toBe(staffRowOne);
      const row = must(await adminClient.from('club_staff').select('status').eq('id', staffRowOne).single(), 'row');
      expect(row.status).toBe('active');
    });

    // The IT role holds no business authority, so who may appoint one is a product
    // decision: the organization's admin does; a club manager does not.
    it('an org admin can appoint a club IT admin', async () => {
      const { data, error } = await orgAdminAClient.rpc('add_club_staff', { p_club_id: clubA.id, p_email: emailTwo, p_role: 'club_it_admin' });
      expect(error).toBeNull();
      const row = must(await adminClient.from('club_staff').select('role, status, user_id').eq('id', data as unknown as string).single(), 'it row');
      expect(row).toMatchObject({ role: 'club_it_admin', status: 'active', user_id: userTwo });
    });

    it('a club manager cannot appoint a club IT admin, and nothing is written', async () => {
      const { error } = await clubAdminAClient.rpc('add_club_staff', { p_club_id: clubA.id, p_email: emailOne, p_role: 'club_it_admin' });
      expect(error).not.toBeNull();
      const { data } = await adminClient.from('club_staff').select('id').eq('club_id', clubA.id).eq('user_id', userOne).eq('role', 'club_it_admin');
      expect(data).toHaveLength(0);
    });

    it('a club manager can still appoint every other role', async () => {
      const { error } = await clubAdminAClient.rpc('add_club_staff', { p_club_id: clubA.id, p_email: emailOne, p_role: 'treasurer' });
      expect(error).toBeNull();
    });

    it('a suspended organization cannot add staff', async () => {
      await adminClient.from('organizations').update({ status: 'suspended' }).eq('id', orgA.id);
      const { error } = await orgAdminAClient.rpc('add_club_staff', { p_club_id: clubA.id, p_email: emailTwo, p_role: 'secretary' });
      await adminClient.from('organizations').update({ status: 'active' }).eq('id', orgA.id);
      expect(error).not.toBeNull();
    });
  });

  describe('link_player_account', () => {
    const linked = async () => must(await adminClient.from('players').select('user_id').eq('id', playerA1.id).single(), 'player').user_id;
    const reset = async () => { await adminClient.from('players').update({ user_id: null }).in('id', [playerA1.id, playerA2.id]); };

    it("a coach assigned to the player's team can link a login", async () => {
      const { error } = await coachA1Client.rpc('link_player_account', { p_player_id: playerA1.id, p_email: emailOne });
      expect(error).toBeNull();
      expect(await linked()).toBe(userOne);
      await reset();
    });

    it('a club manager and an org admin can link one', async () => {
      expect((await clubAdminAClient.rpc('link_player_account', { p_player_id: playerA2.id, p_email: emailOne })).error).toBeNull();
      await reset();
      expect((await orgAdminAClient.rpc('link_player_account', { p_player_id: playerA1.id, p_email: emailTwo })).error).toBeNull();
      await reset();
    });

    it("a coach NOT assigned to that player's team, a guardian, and another organization are refused", async () => {
      expect((await coachA1Client.rpc('link_player_account', { p_player_id: playerA2.id, p_email: emailOne })).error).not.toBeNull();
      expect((await guardianOfA1Client.rpc('link_player_account', { p_player_id: playerA1.id, p_email: emailOne })).error).not.toBeNull();
      expect((await clubStaffBClient.rpc('link_player_account', { p_player_id: playerA1.id, p_email: emailOne })).error).not.toBeNull();
      expect(await linked()).toBeNull();
    });

    it('an email with no account says so, and changes nothing', async () => {
      const { error } = await coachA1Client.rpc('link_player_account', { p_player_id: playerA1.id, p_email: `nobody-${suffix}@rls-test.local` });
      expect(error?.message).toMatch(/no dul(a|à) hq account/i);
      expect(await linked()).toBeNull();
    });
  });

  it('cleans up', async () => {
    await adminClient.from('players').update({ user_id: null }).in('id', [playerA1.id, playerA2.id]);
    await adminClient.from('club_staff').delete().in('user_id', [userOne, userTwo].filter(Boolean));
    await adminClient.from('audit_log').delete().in('entity_id', [staffRowOne].filter(Boolean));
    for (const id of [userOne, userTwo].filter(Boolean)) await adminClient.auth.admin.deleteUser(id);
  });
});

/**
 * §0s finding 5 (phase12d). Team assignment for treasurer/secretary/staff
 * (StaffRow.tsx/page.tsx's TEAM_SCOPED_ROLES) needed no migration -- uat_insert
 * authorizes on the ASSIGNER's own authority, never the assignee's role, so
 * the database already let a club manager put any club_staff row on a team.
 *
 * Verifying that live surfaced the real bug this describe pins: players_read
 * never consulted the permission catalog, so a `staff` role holding
 * manage_finances/view_finances club-wide -- reachable with NO team
 * assignment, since those permissions are club-scope -- read a fee_charges
 * row fine but got a null embedded player, i.e. "Unknown" on the club-wide
 * Finances tab for every player outside their own assigned teams. Confirmed
 * live via SQL impersonation before writing this (a `staff` row's embedded
 * `players(name)` came back null) -- these tests are the same finding, run
 * through the actual client.
 */
describe('players_read honours the same club-wide permissions fee_charges/documents/memberships already do (phase12d)', () => {
  const staffEmail = `rls-office-staff-${crypto.randomUUID().slice(0, 8)}@rls-test.local`;
  const secEmail = `rls-office-sec-${crypto.randomUUID().slice(0, 8)}@rls-test.local`;
  let staffUserId: string;
  let secUserId: string;
  let staffClient: ReturnType<typeof createClient>;
  let secClient: ReturnType<typeof createClient>;

  it('sets up a staff-role and a secretary-role member at club A, neither assigned to any team', async () => {
    const s = await createTestUser(staffEmail, 'audience');
    staffUserId = s.publicUser.id;
    must(await adminClient.from('club_staff').insert({ club_id: clubA.id, user_id: staffUserId, role: 'staff' }).select().single(), 'club_staff staff');
    staffClient = await signInAs(staffEmail);

    const sec = await createTestUser(secEmail, 'audience');
    secUserId = sec.publicUser.id;
    must(await adminClient.from('club_staff').insert({ club_id: clubA.id, user_id: secUserId, role: 'secretary' }).select().single(), 'club_staff secretary');
    secClient = await signInAs(secEmail);
  });

  it('neither is assigned to a team', async () => {
    const { data } = await adminClient.from('user_assigned_teams').select('user_id').in('user_id', [staffUserId, secUserId]);
    expect(data ?? []).toHaveLength(0);
  });

  it('the staff role (manage_finances/view_finances) can read a player by name, with no team assignment', async () => {
    const { data, error } = await staffClient.from('players').select('id, name').eq('id', playerA1.id);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: playerA1.id, name: 'Player A1' }]);
  });

  it("the bug this closes: a fee_charges embed now resolves the player's name instead of coming back null", async () => {
    const { data, error } = await staffClient.from('fee_charges').select('id, players(name)').eq('id', feeA1.id).single();
    expect(error).toBeNull();
    expect((data as any).players).toEqual({ name: 'Player A1' });
  });

  it('the secretary role (manage_documents/manage_membership) can also read the player, with no team assignment', async () => {
    const { data, error } = await secClient.from('players').select('id, name').eq('id', playerA1.id);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: playerA1.id, name: 'Player A1' }]);
  });

  it('read only: the staff role still cannot rename the player', async () => {
    // players_write is untouched by this migration, so this should be refused --
    // but as with uat_write (phase6x), a policy-filtered UPDATE matches zero rows
    // rather than raising, so the persisted value is the real assertion, not the
    // (possibly null) error.
    await staffClient.from('players').update({ name: 'Renamed' }).eq('id', playerA1.id);
    const { data: after } = await adminClient.from('players').select('name').eq('id', playerA1.id).single();
    expect(after?.name).toBe('Player A1');
  });

  it("the permission is checked against the PLAYER's own club, not the caller's -- a club A staff role cannot read club B's player", async () => {
    const { data } = await staffClient.from('players').select('id').eq('id', playerB.id);
    expect(data ?? []).toHaveLength(0);
  });

  it('cleans up', async () => {
    await adminClient.from('club_staff').delete().in('user_id', [staffUserId, secUserId]);
    for (const id of [staffUserId, secUserId]) await adminClient.auth.admin.deleteUser(id);
  });
});

/**
 * Announcements honour manage_communications (phase12e). ann_write was
 * `can_admin_club OR is_assigned_to_team(team_id)` for USING, but its WITH CHECK
 * was only `is_org_member(org_id)` -- and on an INSERT under an ALL policy only
 * WITH CHECK is consulted, so any org member at all (a guardian included) could
 * post to any audience. And a secretary/staff member holding manage_communications
 * (club-scope, "Send team/club announcements") could post only to a team they were
 * assigned to, never club-wide -- the same "permission granted, nothing honours it"
 * shape as players_read (§0s finding 5).
 */
describe('announcements honour manage_communications (phase12e)', () => {
  const tag = `rls-ann-${crypto.randomUUID().slice(0, 8)}`;
  const secEmail = `rls-ann-sec-${crypto.randomUUID().slice(0, 8)}@rls-test.local`;
  const trEmail = `rls-ann-tr-${crypto.randomUUID().slice(0, 8)}@rls-test.local`;
  let secId: string;
  let trId: string;
  let secClient: ReturnType<typeof createClient>;
  let trClient: ReturnType<typeof createClient>;
  const post = (client: ReturnType<typeof createClient>, audience: string, teamId: string | null, suffix: string) =>
    client.from('announcements').insert({
      club_id: clubA.id, title: `${tag}-${suffix}`, body: 'x', audience, team_id: teamId,
    });
  const exists = async (suffix: string) =>
    ((await adminClient.from('announcements').select('id').eq('title', `${tag}-${suffix}`)).data ?? []).length === 1;

  it('sets up a secretary and a treasurer at club A, neither assigned to a team', async () => {
    secId = (await createTestUser(secEmail, 'audience')).publicUser.id;
    trId = (await createTestUser(trEmail, 'audience')).publicUser.id;
    must(await adminClient.from('club_staff').insert({ club_id: clubA.id, user_id: secId, role: 'secretary' }).select().single(), 'secretary');
    must(await adminClient.from('club_staff').insert({ club_id: clubA.id, user_id: trId, role: 'treasurer' }).select().single(), 'treasurer');
    secClient = await signInAs(secEmail);
    trClient = await signInAs(trEmail);
  });

  it('a guardian cannot post an announcement (the WITH CHECK hole)', async () => {
    await post(guardianOfA1Client, 'club', null, 'guardian');
    expect(await exists('guardian')).toBe(false);
  });

  it('the IT admin and a different club\'s manager cannot post either', async () => {
    await post(itAdminAClient, 'club', null, 'it');
    await post(clubStaffBClient, 'club', null, 'clubb');
    expect(await exists('it')).toBe(false);
    expect(await exists('clubb')).toBe(false);
  });

  it('a coach posts to their own team, and only to it', async () => {
    expect((await post(coachA1Client, 'team', teamA1.id, 'coach-own')).error).toBeNull();
    await post(coachA1Client, 'team', teamA2.id, 'coach-other');
    await post(coachA1Client, 'club', null, 'coach-club');
    expect(await exists('coach-own')).toBe(true);
    expect(await exists('coach-other')).toBe(false);
    expect(await exists('coach-club')).toBe(false);
  });

  it('a coach cannot dress a club-wide announcement up as a team one', async () => {
    await post(coachA1Client, 'club', teamA1.id, 'coach-disguised');
    expect(await exists('coach-disguised')).toBe(false);
  });

  it('a secretary (manage_communications) can post club-wide and to any team, with no assignment', async () => {
    expect((await post(secClient, 'club', null, 'sec-club')).error).toBeNull();
    expect((await post(secClient, 'team', teamA2.id, 'sec-team')).error).toBeNull();
    expect(await exists('sec-club')).toBe(true);
    expect(await exists('sec-team')).toBe(true);
  });

  it('a secretary can pin and delete an announcement', async () => {
    await secClient.from('announcements').update({ pinned: true }).eq('title', `${tag}-sec-club`);
    expect(((await adminClient.from('announcements').select('pinned').eq('title', `${tag}-sec-club`).single()).data as any).pinned).toBe(true);
    await secClient.from('announcements').delete().eq('title', `${tag}-sec-team`);
    expect(await exists('sec-team')).toBe(false);
  });

  it('a treasurer (no manage_communications) cannot post', async () => {
    await post(trClient, 'club', null, 'treasurer');
    await post(trClient, 'team', teamA1.id, 'treasurer-team');
    expect(await exists('treasurer')).toBe(false);
    expect(await exists('treasurer-team')).toBe(false);
  });

  it('a club manager still posts anything', async () => {
    expect((await post(clubAdminAClient, 'guardians', null, 'mgr')).error).toBeNull();
    expect(await exists('mgr')).toBe(true);
  });

  it('cleans up', async () => {
    await adminClient.from('announcements').delete().like('title', `${tag}-%`);
    await adminClient.from('club_staff').delete().in('user_id', [secId, trId]);
    for (const id of [secId, trId]) await adminClient.auth.admin.deleteUser(id);
  });
});

/**
 * Creating a team from the club page. The screen could only link an existing
 * unclaimed team, so a new club could never get its first team. teams_write is
 * can_admin_club; fill_org_id derives org_id from the club; (club_id, slug) is
 * unique, which the action relies on to pick a free slug.
 */
describe('creating a team (createTeam)', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const made: string[] = [];

  it('a club manager can create a team, and org_id is derived from the club', async () => {
    const { data, error } = await clubAdminAClient.from('teams')
      .insert({ club_id: clubA.id, name: `RLS New ${tag}`, slug: `rls-new-${tag}`, squad_type: 'grassroots' })
      .select('id, org_id, club_id').single();
    expect(error).toBeNull();
    expect(data!.org_id).toBe(orgA.id);
    made.push(data!.id);
  });

  it('a second team with the same slug in the same club is refused (23505), so the action can retry with a suffix', async () => {
    const { error } = await clubAdminAClient.from('teams')
      .insert({ club_id: clubA.id, name: 'Dup', slug: `rls-new-${tag}`, squad_type: 'grassroots' });
    expect(error?.code).toBe('23505');
  });

  it('an org admin can create one; a coach, a guardian and another club\'s manager cannot', async () => {
    const ok = await orgAdminAClient.from('teams').insert({ club_id: clubA.id, name: 'OA', slug: `rls-oa-${tag}`, squad_type: 'adult' }).select('id').single();
    expect(ok.error).toBeNull();
    made.push(ok.data!.id);
    for (const [who, client] of [['coach', coachA1Client], ['guardian', guardianOfA1Client], ['club B manager', clubStaffBClient]] as const) {
      const r = await client.from('teams').insert({ club_id: clubA.id, name: who, slug: `rls-x-${who.replace(/\W/g, '')}-${tag}`, squad_type: 'grassroots' });
      expect(r.error, who).not.toBeNull();
    }
    expect(((await adminClient.from('teams').select('id').like('slug', `rls-x-%-${tag}`)).data ?? [])).toHaveLength(0);
  });

  it('cleans up', async () => {
    await adminClient.from('teams').delete().in('id', made);
  });
});

/**
 * Public listing (phase13a, docs/proposals/public-listing.md). The owner opts in, held
 * by the club IT admin and tournament IT admin (plus org admin); a platform admin can
 * block. The flag was writable by any club manager through the API with nothing
 * guarding it, and a tournament IT admin could not write it at all.
 */
describe('public listing: owner opt-in, platform block (phase13a)', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const paEmail = `rls-list-pa-${tag}@rls-test.local`;
  const titEmail = `rls-list-tit-${tag}@rls-test.local`;
  let paId: string;
  let titId: string;
  let paClient: ReturnType<typeof createClient>;
  let titClient: ReturnType<typeof createClient>;
  let tId: string;
  const anon = () => createClient(SUPABASE_URL, ANON_KEY);
  const listedClubs = async () => ((await anon().from('public_clubs').select('id').eq('id', clubA.id)).data ?? []).length === 1;
  const listedTournament = async () => ((await anon().from('public_tournaments').select('id').eq('id', tId)).data ?? []).length === 1;
  const flag = async (table: 'clubs' | 'tournaments', id: string) =>
    (await adminClient.from(table).select('publicly_listed, listing_blocked').eq('id', id).single()).data as any;

  it('sets up a platform admin, a tournament IT admin and a tournament, all unlisted', async () => {
    paId = (await createTestUser(paEmail, 'platform_admin')).publicUser.id;
    must(await adminClient.from('platform_admins').insert({ email: paEmail }).select().single(), 'platform admin');
    paClient = await signInAs(paEmail);
    titId = (await createTestUser(titEmail, 'audience')).publicUser.id;
    tId = must(await adminClient.from('tournaments')
      .insert({ name: 'RLS Listing Cup', org_id: orgA.id, slug: `rls-list-${tag}` }).select().single(), 'tournament').id;
    must(await adminClient.from('tournament_staff')
      .insert({ tournament_id: tId, user_id: titId, role: 'tournament_it_admin', org_id: orgA.id }).select().single(), 'tournament it admin');
    titClient = await signInAs(titEmail);
    await adminClient.from('clubs').update({ publicly_listed: false }).eq('id', clubA.id);
    expect(await listedClubs()).toBe(false);
    expect(await listedTournament()).toBe(false);
  });

  it('the IT roles hold the listing permission; nobody else does by default', async () => {
    const club = (c: ReturnType<typeof createClient>) => c.rpc('has_staff_permission', { p_permission_key: 'manage_club_listing', p_club_id: clubA.id });
    expect((await club(itAdminAClient)).data).toBe(true);
    expect((await club(clubAdminAClient)).data).toBe(false);
    expect((await club(coachA1Client)).data).toBe(false);
    const t = (c: ReturnType<typeof createClient>) => c.rpc('has_tournament_permission', { p_permission_key: 'manage_tournament_listing', p_tournament_id: tId });
    expect((await t(titClient)).data).toBe(true);
    expect((await t(coachA1Client)).data).toBe(false);
  });

  it('the club IT admin can list the club, and it appears in the public directory', async () => {
    const { error } = await itAdminAClient.rpc('set_public_listing', { p_kind: 'club', p_id: clubA.id, p_listed: true });
    expect(error).toBeNull();
    expect(await listedClubs()).toBe(true);
  });

  it('a club manager, a coach and another clubs manager cannot LIST a club, by RPC or by a direct write', async () => {
    await adminClient.from('clubs').update({ publicly_listed: false }).eq('id', clubA.id);
    for (const c of [clubAdminAClient, coachA1Client, clubStaffBClient]) {
      expect((await c.rpc('set_public_listing', { p_kind: 'club', p_id: clubA.id, p_listed: true })).error).not.toBeNull();
    }
    // the hole this closes: clubs_admin_write let a club manager write any column
    await clubAdminAClient.from('clubs').update({ publicly_listed: true }).eq('id', clubA.id);
    expect((await flag('clubs', clubA.id)).publicly_listed).toBe(false);
  });

  it('an org admin can list; a club manager can take a listing DOWN', async () => {
    expect((await orgAdminAClient.rpc('set_public_listing', { p_kind: 'club', p_id: clubA.id, p_listed: true })).error).toBeNull();
    expect(await listedClubs()).toBe(true);
    expect((await clubAdminAClient.rpc('set_public_listing', { p_kind: 'club', p_id: clubA.id, p_listed: false })).error).toBeNull();
    expect(await listedClubs()).toBe(false);
  });

  it('only a platform admin can block; a block hides a listed club, from the views AND the table', async () => {
    await itAdminAClient.rpc('set_public_listing', { p_kind: 'club', p_id: clubA.id, p_listed: true });
    for (const c of [itAdminAClient, orgAdminAClient, clubAdminAClient]) {
      expect((await c.rpc('set_listing_block', { p_kind: 'club', p_id: clubA.id, p_blocked: true, p_reason: 'no' })).error).not.toBeNull();
    }
    await orgAdminAClient.from('clubs').update({ listing_blocked: true }).eq('id', clubA.id);
    expect((await flag('clubs', clubA.id)).listing_blocked).toBe(false);

    expect((await paClient.rpc('set_listing_block', { p_kind: 'club', p_id: clubA.id, p_blocked: true, p_reason: 'test' })).error).toBeNull();
    expect((await flag('clubs', clubA.id)).publicly_listed).toBe(true); // the owner's choice is kept
    expect(await listedClubs()).toBe(false);
    expect(((await anon().from('clubs').select('id').eq('id', clubA.id)).data ?? [])).toHaveLength(0);

    expect((await paClient.rpc('set_listing_block', { p_kind: 'club', p_id: clubA.id, p_blocked: false, p_reason: null })).error).toBeNull();
    expect(await listedClubs()).toBe(true);
  });

  it('the tournament IT admin can list a tournament; a coach cannot; a block hides it', async () => {
    expect((await coachA1Client.rpc('set_public_listing', { p_kind: 'tournament', p_id: tId, p_listed: true })).error).not.toBeNull();
    expect((await titClient.rpc('set_public_listing', { p_kind: 'tournament', p_id: tId, p_listed: true })).error).toBeNull();
    expect(await listedTournament()).toBe(true);
    expect((await titClient.rpc('set_listing_block', { p_kind: 'tournament', p_id: tId, p_blocked: true, p_reason: 'x' })).error).not.toBeNull();
    expect((await paClient.rpc('set_listing_block', { p_kind: 'tournament', p_id: tId, p_blocked: true, p_reason: 'test' })).error).toBeNull();
    expect(await listedTournament()).toBe(false);
  });

  it('listing and blocking are audited', async () => {
    const { data } = await adminClient.from('audit_log').select('action').eq('entity_id', clubA.id).like('action', 'club.listing%');
    const actions = (data ?? []).map((r: any) => r.action);
    expect(actions).toContain('club.listing.changed');
    expect(actions).toContain('club.listing.blocked');
  });

  it('cleans up', async () => {
    await adminClient.from('audit_log').delete().in('entity_id', [clubA.id, tId]).like('action', '%.listing.%');
    await adminClient.from('tournament_staff').delete().eq('tournament_id', tId);
    await adminClient.from('tournaments').delete().eq('id', tId);
    await adminClient.from('clubs').update({ publicly_listed: false, listing_blocked: false }).eq('id', clubA.id);
    await adminClient.from('platform_admins').delete().eq('email', paEmail);
    for (const id of [paId, titId]) await adminClient.auth.admin.deleteUser(id);
  });
});
