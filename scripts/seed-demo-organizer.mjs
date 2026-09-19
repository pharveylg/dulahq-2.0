// Adds (or repairs) the tournament-only Organizer demo persona WITHOUT the full
// re-seed. seed-showcase-demo.mjs wipes and rebuilds every showcase org, which
// is the wrong tool for adding one account to a database people are already
// using; this touches exactly two things and is safe to run repeatedly:
//
//   1. the auth account + public.users name
//   2. one tournament_staff row (role organizer) on Davao Unity Sports' Tiger Cup
//
// The persona deliberately belongs to NO org (no org_members, no role_assignments,
// no club staff). Everything it can do comes from tournament_staff, which is the
// only way to exercise the organizer console as someone who is not also an org
// admin -- the case the console's RLS policies were written for and that every
// other demo account (all Usna Gali members) cannot reach.
//
// The full seed (seed-showcase-demo.mjs) creates the same account, so a re-seed
// keeps it; keep the email/name/slugs below in step with that file and with
// src/app/demo/DemoPersonas.tsx.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const PASSWORD = 'DemoPass2026!';
const EMAIL = 'organizer.tiger-cup.davao-unity-sports@dulahq-showcase.local';
const NAME = 'Dennis Manalo';
const ORG_SLUG = 'davao-unity-sports';
const TOURNAMENT_SLUG = 'tiger-cup';

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
let user = existing.users.find((u) => u.email === EMAIL);
if (!user) {
  const created = await must(admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true }), 'createUser');
  user = created.user;
  console.log(`Created account ${EMAIL}`);
} else {
  // Re-assert the password so the shared demo password always works.
  await must(admin.auth.admin.updateUserById(user.id, { password: PASSWORD }), 'reset password');
  console.log(`Account ${EMAIL} already exists`);
}
await must(admin.from('users').update({ name: NAME }).eq('id', user.id).select().single(), 'set name');

await must(
  admin.from('tournament_staff').upsert(
    { tournament_id: tournament.id, user_id: user.id, role: 'organizer', org_id: org.id, status: 'active' },
    { onConflict: 'tournament_id,user_id,role' }
  ),
  'tournament_staff organizer'
);
console.log(`${NAME} is an active organizer of ${TOURNAMENT_SLUG} (${ORG_SLUG}). Password: ${PASSWORD}`);
