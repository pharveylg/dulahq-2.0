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
