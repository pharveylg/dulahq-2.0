// Adds (or repairs) the linked-official demo persona WITHOUT the full
// re-seed -- same pattern as scripts/seed-demo-organizer.mjs.
//
// Links a real account to the EXISTING "Mark Bendijo" org_officials row
// (Davao Unity Sports, Head Referee) that seed-showcase-demo.mjs already
// created and already assigned as 'referee' on both Tiger Cup and National
// Team Qualifiers -- rather than creating a new, unassigned pool member, so
// /official's Assignments list has real data to show from the first sign-in.
//
// The full seed (seed-showcase-demo.mjs) links the same official, so a
// re-seed keeps it; keep the email/name/lookup below in step with that file
// and with src/lib/demo-personas.ts.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const PASSWORD = 'DemoPass2026!';
const EMAIL = 'referee.davao-unity-sports@dulahq-showcase.local';
const NAME = 'Mark Bendijo';
const OFFICIAL_EMAIL = 'davao-unity-sports.official1@dulahq-showcase.local';

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

const official = await must(
  admin.from('org_officials').select('id, full_name').eq('email', OFFICIAL_EMAIL).maybeSingle(),
  'find official'
);
if (!official) throw new Error(`No org_officials row "${OFFICIAL_EMAIL}" -- run scripts/seed-showcase-demo.mjs first.`);

const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
let user = existing.users.find((u) => u.email === EMAIL);
if (!user) {
  const created = await must(admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true }), 'createUser');
  user = created.user;
  console.log(`Created account ${EMAIL}`);
} else {
  await must(admin.auth.admin.updateUserById(user.id, { password: PASSWORD }), 'reset password');
  console.log(`Account ${EMAIL} already exists`);
}
await must(admin.from('users').update({ name: NAME }).eq('id', user.id).select().single(), 'set name');
await must(admin.from('org_officials').update({ user_id: user.id }).eq('id', official.id).select().single(), 'link official');

console.log(`${NAME} is linked to org_officials ${official.id} (${OFFICIAL_EMAIL}). Password: ${PASSWORD}`);
