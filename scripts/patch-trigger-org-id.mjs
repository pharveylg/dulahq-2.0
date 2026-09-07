// One-off script: the Supabase type generator doesn't know about BEFORE
// INSERT triggers, so it marks org_id as required in the Insert type for
// every table, even the 36 where fill_org_id_from_parent() derives it from
// the parent row. This patches just those tables' Insert (not Row -- the
// persisted row always has it -- and not Update, already optional) so the
// generated types match actual insert-time behavior. Not meant to be
// re-run generically; the table list was pulled from pg_trigger directly.
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/lib/supabase/database.types.ts';
const src = readFileSync(path, 'utf-8');

const TABLES = [
  'announcement_reads', 'announcements', 'attendance', 'club_staff',
  'development_goal_drills', 'development_goals', 'document_uploads', 'drills',
  'expenses', 'fee_charges', 'live_embeds', 'match_events', 'media',
  'meeting_action_items', 'meetings', 'membership_export_requests',
  'memberships', 'payments', 'player_development_notes', 'player_evaluations',
  'player_guardians', 'player_skill_ratings', 'players', 'session_drills',
  'team_memberships', 'team_staff', 'teams', 'tournament_categories',
  'tournament_members', 'tournament_officials', 'tournament_roster',
  'training_sessions', 'trip_passengers', 'trip_transportation', 'trips',
  'user_assigned_teams',
];

// Table blocks are top-level entries of `Tables: { ... }`, each starting
// with exactly 6-space-indented `<name>: {` and ending at the next sibling
// entry (found the same way) or Tables' own closing brace.
const blockStart = (name) => new RegExp(`\\n      ${name}: \\{\\n`);
const nextSiblingOrEnd = /\n      \w+: \{\n|\n    \}\n    Views:/;

let out = src;
let patched = 0;
for (const table of TABLES) {
  const startMatch = blockStart(table).exec(out);
  if (!startMatch) { console.error('NO BLOCK START for', table); continue; }
  const blockStartIdx = startMatch.index + 1; // skip leading \n
  nextSiblingOrEnd.lastIndex = 0;
  const rest = out.slice(blockStartIdx + startMatch[0].length - 1);
  const endMatch = nextSiblingOrEnd.exec(rest);
  if (!endMatch) { console.error('NO BLOCK END for', table); continue; }
  const blockEndIdx = blockStartIdx + startMatch[0].length - 1 + endMatch.index;

  const block = out.slice(blockStartIdx, blockEndIdx);
  const insertMatch = /Insert: \{\n([\s\S]*?)\n        \}\n        Update:/.exec(block);
  if (!insertMatch) { console.error('NO Insert BLOCK for', table); continue; }

  const insertBody = insertMatch[1];
  if (!/^\s*org_id: string$/m.test(insertBody)) {
    console.error('NO required org_id in Insert for', table, '-- skipping (already optional or absent)');
    continue;
  }
  const newInsertBody = insertBody.replace(/^(\s*)org_id: string$/m, '$1org_id?: string');
  const newBlock = block.slice(0, insertMatch.index) +
    insertMatch[0].replace(insertBody, newInsertBody) +
    block.slice(insertMatch.index + insertMatch[0].length);

  out = out.slice(0, blockStartIdx) + newBlock + out.slice(blockEndIdx);
  patched += 1;
}

writeFileSync(path, out);
console.log(`patched ${patched} / ${TABLES.length} tables`);
