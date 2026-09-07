// Seeds standing (non-ephemeral) demo accounts covering every RBAC role,
// plus club and tournament data for them to explore. Deliberately separate
// from loadDemoData/wipeDemoData (org slug dulahq-rbac-demo, not dula-demo)
// so clicking "Wipe demo data" on /clubs never touches this.
//
// Uses the service-role key directly -- this is a one-time seed script run
// locally, not shipped in the app, so there's no RLS-bypass surface to
// worry about the way there would be if this logic lived in a Server Action.
//
// Re-runnable: deletes any prior run's org (cascades most of it) before
// reseeding, and looks up/deletes prior auth users by email first.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const ORG_SLUG = 'dulahq-rbac-demo';
const DEMO_PASSWORD = 'DemoPass2026!';

const PERSONAS = [
  { key: 'platformadmin', email: 'demo-platformadmin@dulahq-demo.local', name: 'Priya Admin' },
  { key: 'orgadmin', email: 'demo-orgadmin@dulahq-demo.local', name: 'Omar Rivera' },
  { key: 'clubadmin', email: 'demo-clubadmin@dulahq-demo.local', name: 'Carla Bennett' },
  { key: 'coach', email: 'demo-coach@dulahq-demo.local', name: 'Coach Dana Wells' },
  { key: 'teammanager', email: 'demo-teammanager@dulahq-demo.local', name: 'Tariq Manager' },
  { key: 'staff', email: 'demo-staff@dulahq-demo.local', name: 'Sam Ito (Staff)' },
  { key: 'guardian', email: 'demo-guardian@dulahq-demo.local', name: 'Grace Alvarez' },
  { key: 'player', email: 'demo-player@dulahq-demo.local', name: 'Jordan Alvarez' },
];

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function cleanupPriorRun() {
  const { data: existingOrg } = await admin.from('organizations').select('id').eq('slug', ORG_SLUG).maybeSingle();
  if (existingOrg) {
    // clubs/teams/tournaments cascade or SET NULL depending on the FK;
    // deleting the org first, then sweeping anything it leaves behind by
    // name, covers both.
    await admin.from('organizations').delete().eq('id', existingOrg.id);
  }
  await admin.from('teams').delete().ilike('name', 'Demo %');
  await admin.from('tournaments').delete().eq('slug', 'dulahq-demo-cup');

  const { data: users } = await admin.auth.admin.listUsers();
  for (const p of PERSONAS) {
    const u = users.users.find((u) => u.email === p.email);
    if (u) {
      await admin.from('users').delete().eq('id', u.id);
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}

async function main() {
  console.log('Cleaning up any prior run...');
  await cleanupPriorRun();

  console.log('Creating auth accounts...');
  const ids = {};
  for (const p of PERSONAS) {
    const user = await must(
      admin.auth.admin.createUser({ email: p.email, password: DEMO_PASSWORD, email_confirm: true }),
      `createUser ${p.email}`
    );
    ids[p.key] = user.user.id;
    // the phase1 trigger creates the public.users row; just set the display name.
    await must(
      admin.from('users').update({ name: p.name }).eq('id', user.user.id).select().single(),
      `set name ${p.email}`
    );
  }

  console.log('Seeding org, entitlements, club...');
  const org = await must(
    admin.from('organizations').insert({ slug: ORG_SLUG, name: 'Dula HQ Demo' }).select().single(),
    'insert organizations'
  );
  await must(
    admin.from('org_entitlements').insert([
      { org_id: org.id, product: 'club' },
      { org_id: org.id, product: 'tournament' },
    ]),
    'insert org_entitlements'
  );
  await must(
    admin.from('org_members').insert({ org_id: org.id, email: PERSONAS.find((p) => p.key === 'orgadmin').email, user_id: ids.orgadmin, role: 'admin' }),
    'insert org_members'
  );
  await must(
    admin.from('platform_admins').insert({ email: PERSONAS.find((p) => p.key === 'platformadmin').email }),
    'insert platform_admins'
  );

  const { data: football } = await admin.from('sports').select('id').eq('key', 'football').single();

  const club = await must(
    admin
      .from('clubs')
      .insert({ name: 'Dula HQ Demo Club', slug: 'dulahq-demo-club', org_id: org.id, sport_id: football.id, publicly_listed: true, about: 'A standing demo club covering every RBAC role -- see /demo for accounts.' })
      .select()
      .single(),
    'insert clubs'
  );

  console.log('Seeding teams and players...');
  const [u12, u15] = await must(
    admin
      .from('teams')
      .insert([
        { name: 'Demo U12', slug: 'demo-u12', club_id: club.id },
        { name: 'Demo U15', slug: 'demo-u15', club_id: club.id },
      ])
      .select(),
    'insert teams'
  );

  const u12PlayersSeed = [
    { name: 'Jordan Alvarez', jersey: '7', position: 'Forward', dob: '2013-04-11' },
    { name: 'Riley Chen', jersey: '4', position: 'Defender', dob: '2013-08-02' },
    { name: 'Sam Okafor', jersey: '1', position: 'Goalkeeper', dob: '2012-11-19' },
    { name: 'Ava Martinez', jersey: '10', position: 'Midfielder', dob: '2013-01-27' },
  ].map((p) => ({ ...p, team_id: u12.id }));
  const u15PlayersSeed = [
    { name: 'Devon Brooks', jersey: '9', position: 'Forward', dob: '2010-05-14' },
    { name: 'Maya Singh', jersey: '3', position: 'Defender', dob: '2010-09-30' },
    { name: 'Leo Fischer', jersey: '1', position: 'Goalkeeper', dob: '2011-02-08' },
    { name: 'Nina Kowalski', jersey: '11', position: 'Forward', dob: '2010-12-01' },
  ].map((p) => ({ ...p, team_id: u15.id }));

  const players = await must(
    admin.from('players').insert([...u12PlayersSeed, ...u15PlayersSeed]).select(),
    'insert players'
  );
  const jordan = players.find((p) => p.name === 'Jordan Alvarez');

  // Link the demo player account to Jordan's roster row.
  await must(admin.from('players').update({ user_id: ids.player }).eq('id', jordan.id), 'link player account');

  console.log('Assigning club_staff roles...');
  await must(
    admin.from('club_staff').insert([
      { club_id: club.id, user_id: ids.clubadmin, role: 'club_admin' },
      { club_id: club.id, user_id: ids.coach, role: 'coach' },
      { club_id: club.id, user_id: ids.teammanager, role: 'team_manager' },
      { club_id: club.id, user_id: ids.staff, role: 'staff' },
    ]),
    'insert club_staff'
  );
  await must(
    admin.from('user_assigned_teams').insert([
      { user_id: ids.coach, team_id: u12.id },
      { user_id: ids.teammanager, team_id: u15.id },
    ]),
    'insert user_assigned_teams'
  );

  console.log('Linking the guardian account...');
  const guardian = await must(
    admin
      .from('guardians')
      .insert({ org_id: org.id, user_id: ids.guardian, name: 'Grace Alvarez', account_status: 'active', contact_info: { phone: '555-0100', email: PERSONAS.find((p) => p.key === 'guardian').email } })
      .select()
      .single(),
    'insert guardians'
  );
  await must(
    admin.from('player_guardians').insert({ org_id: org.id, player_id: jordan.id, guardian_id: guardian.id, relationship: 'parent', is_primary_contact: true }),
    'insert player_guardians'
  );

  console.log('Seeding a training session, attendance, fees, and an announcement...');
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const session = await must(
    admin
      .from('training_sessions')
      .insert({ club_id: club.id, team_id: u12.id, starts_at: new Date(now - 3 * day).toISOString(), ends_at: new Date(now - 3 * day + 60 * 60_000).toISOString(), status: 'completed', theme: 'Possession', objective: 'Keep the ball under pressure', coach_id: ids.coach, created_by: ids.coach })
      .select()
      .single(),
    'insert training_sessions'
  );
  await must(
    admin.from('attendance').insert(
      u12PlayersSeed.map((_, i) => ({ training_session_id: session.id, player_id: players[i].id, status: i === 2 ? 'absent' : 'present' }))
    ),
    'insert attendance'
  );
  // status is never set by hand (§5) -- a trigger on payments derives it.
  // Both start 'pending'; Jordan's gets an actual payment below so the
  // trigger recomputes it to 'paid'.
  const [jordanCharge] = await must(
    admin
      .from('fee_charges')
      .insert([
        { club_id: club.id, player_id: jordan.id, fee_type: 'membership', amount: 150, currency: 'USD', status: 'pending', created_by: ids.staff },
        { club_id: club.id, player_id: players[1].id, fee_type: 'membership', amount: 150, currency: 'USD', status: 'pending', created_by: ids.staff },
      ])
      .select(),
    'insert fee_charges'
  );
  await must(
    admin.from('payments').insert({ fee_charge_id: jordanCharge.id, amount: 150, method: 'card', created_by: ids.staff }),
    'insert payments'
  );
  await must(
    admin.from('announcements').insert({ club_id: club.id, title: 'Welcome to the Dula HQ Demo Club', body: 'This club exists to show every RBAC role in one place -- see /demo for the account list.', audience: 'club', pinned: true, created_by: ids.clubadmin }),
    'insert announcements'
  );

  console.log('Seeding a public demo tournament (empty bracket -- see note below)...');
  await must(
    admin
      .from('tournaments')
      .insert({ org_id: org.id, name: 'Dula HQ Demo Cup', slug: 'dulahq-demo-cup', sport_id: football.id, publicly_listed: true })
      .select()
      .single(),
    'insert tournaments'
  );

  console.log('\nDone.');
  console.log(`Org: ${ORG_SLUG}   Club: /clubs/dulahq-demo-club   Tournament: /t/${ORG_SLUG}/dulahq-demo-cup`);
  console.log(`Shared password for every persona: ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error('SEED FAILED:', err.message);
  process.exit(1);
});
