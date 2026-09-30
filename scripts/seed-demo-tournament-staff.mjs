// Adds (or repairs) the six remaining tournament_staff demo personas WITHOUT
// the full re-seed -- same pattern as scripts/seed-demo-organizer.mjs, which
// this deliberately mirrors rather than duplicating logic differently.
//
// /demo's "Tournament Roles" section had only Org admin and Organizer, while
// "Club Roles" has one persona per club_staff role -- this closes that gap
// with the rest of the tournament_staff catalog (tournament_it_admin,
// team_coordinator, secretary, treasurer, communications, referee_coordinator;
// logistics/volunteer_coordinator were retired in phase15e, §0u).
//
// All six join the same tournament as the existing Organizer persona (Tiger
// Cup, Davao Unity Sports) rather than being spread out, so all seven
// tournament roles are directly comparable in one console -- same reasoning
// as the coach/team-manager pair sharing U15 Girls on the club side.
//
// The full seed (seed-showcase-demo.mjs) creates the same six accounts, so a
// re-seed keeps them; keep the emails/names/role list below in step with that
// file and with src/lib/demo-personas.ts.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const PASSWORD = 'DemoPass2026!';
const ORG_SLUG = 'davao-unity-sports';
const TOURNAMENT_SLUG = 'tiger-cup';

const ROLES = [
  { role: 'tournament_it_admin', email: `tournamentit.tiger-cup.${ORG_SLUG}@dulahq-showcase.local`, name: 'Ariel Salazar' },
  { role: 'team_coordinator', email: `teamcoordinator.tiger-cup.${ORG_SLUG}@dulahq-showcase.local`, name: 'Camille Ocampo' },
  { role: 'secretary', email: `tournamentsecretary.tiger-cup.${ORG_SLUG}@dulahq-showcase.local`, name: 'Noel Fernandez' },
  { role: 'treasurer', email: `tournamenttreasurer.tiger-cup.${ORG_SLUG}@dulahq-showcase.local`, name: 'Grace Domingo' },
  { role: 'communications', email: `tournamentcomms.tiger-cup.${ORG_SLUG}@dulahq-showcase.local`, name: 'Marcus Pascual' },
  { role: 'referee_coordinator', email: `refereecoordinator.tiger-cup.${ORG_SLUG}@dulahq-showcase.local`, name: 'Teodoro Navarro' },
];

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

const org = await must(admin.from('organizations').select('id').eq('slug', ORG_SLUG).maybeSingle(), 'find org');
if (!org) throw new Error(`No organization "${ORG_SLUG}" -- run scripts/seed-showcase-demo.mjs first.`);
const tournament = await must(
  admin.from('tournaments').select('id').eq('org_id', org.id).eq('slug', TOURNAMENT_SLUG).maybeSingle(),
  'find tournament'
);
if (!tournament) throw new Error(`No tournament "${TOURNAMENT_SLUG}" in ${ORG_SLUG}.`);

const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });

for (const { role, email, name } of ROLES) {
  let user = existing.users.find((u) => u.email === email);
  if (!user) {
    const created = await must(admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true }), `createUser ${email}`);
    user = created.user;
    console.log(`Created account ${email}`);
  } else {
    await must(admin.auth.admin.updateUserById(user.id, { password: PASSWORD }), `reset password ${email}`);
    console.log(`Account ${email} already exists`);
  }
  await must(admin.from('users').update({ name }).eq('id', user.id).select().single(), `set name ${email}`);
  await must(
    admin.from('tournament_staff').upsert(
      { tournament_id: tournament.id, user_id: user.id, role, org_id: org.id, status: 'active' },
      { onConflict: 'tournament_id,user_id,role' }
    ),
    `tournament_staff ${role}`
  );
  console.log(`${name} is an active ${role} of ${TOURNAMENT_SLUG} (${ORG_SLUG}).`);
}
console.log(`\nPassword for every account above: ${PASSWORD}`);
