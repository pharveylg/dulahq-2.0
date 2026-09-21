// Renders the permission tables inside docs/guides from the live permission
// catalog, so a guide can never say a role can do something it can't (or miss
// something it can). Pure -- no database, no filesystem -- so it is unit-tested
// directly; scripts/generate-guide-permissions.mjs does the fetching and writing.
//
// A guide opts in with a marker pair around the table:
//
//   <!-- BEGIN permissions: club:coach -->
//   ...generated, do not edit...
//   <!-- END permissions -->
//
// The marker is "<context>:<role>", or just "guardian".
//
// Why a context is needed at all: role_permission_defaults is one flat
// (role, permission) table, and "secretary" and "treasurer" are deliberately the
// same string for a club and for a tournament. Which of a role's keys belong to
// which is decided by the permission's own scope -- the same rule the database
// helpers apply -- plus three keys that both products share.

// Catalogued as club-scope but honoured by has_tournament_permission too
// (CLAUDE.md 0l). They are the only cross-over.
export const REUSED_TOURNAMENT_KEYS = new Set(['view_audit_log', 'manage_account_status', 'submit_support_request']);

const CONTEXTS = new Set(['club', 'tournament', 'guardian']);

// How far a permission reaches, in the words a reader would use.
const REACH = {
  club: 'Whole club',
  team: 'Assigned teams only',
  tournament: 'This tournament',
  player: 'Their own child',
};
const REACH_ORDER = ['club', 'team', 'tournament', 'player'];

// has_staff_permission short-circuits the team fence for club_manager, so a team-level
// permission reaches every team in the club for them. For every other role it stays
// limited to the teams they're assigned to.
const CLUB_WIDE_ROLES = new Set(['club_manager']);

function reachFor(permission, role, context) {
  if (permission.scope === 'team' && CLUB_WIDE_ROLES.has(role)) return 'Every team in the club';
  // The shared keys are catalogued as club scope, but a tournament role holds them for
  // its own tournament, so "Whole club" would be wrong in a tournament table.
  if (context === 'tournament' && REUSED_TOURNAMENT_KEYS.has(permission.key)) return REACH.tournament;
  return REACH[permission.scope] ?? cell(permission.scope);
}

function inContext(permission, context) {
  if (context === 'club') return permission.scope === 'club' || permission.scope === 'team';
  if (context === 'tournament') return permission.scope === 'tournament' || REUSED_TOURNAMENT_KEYS.has(permission.key);
  return true; // guardian: every default is a player-scope key
}

/** The permissions a role holds by default in one context, in reading order. */
export function bundleFor(catalog, context, role) {
  if (!CONTEXTS.has(context)) throw new Error(`Unknown permissions context "${context}" (expected club, tournament or guardian).`);

  let keys;
  if (context === 'guardian') {
    keys = catalog.guardianDefaults.map((g) => g.permission_key);
  } else {
    if (!catalog.roleDefaults.some((r) => r.role === role)) {
      throw new Error(`Unknown role "${role}": it has no rows in role_permission_defaults.`);
    }
    keys = catalog.roleDefaults.filter((r) => r.role === role).map((r) => r.permission_key);
  }

  const byKey = new Map(catalog.permissions.map((p) => [p.key, p]));
  const bundle = keys
    .map((k) => byKey.get(k))
    .filter(Boolean)
    .filter((p) => inContext(p, context))
    .sort((a, b) => REACH_ORDER.indexOf(a.scope) - REACH_ORDER.indexOf(b.scope) || a.label.localeCompare(b.label));

  // A marker that resolves to nothing is nearly always the wrong context for
  // the role ("club:organizer"); an empty table would hide that.
  if (bundle.length === 0) throw new Error(`Role "${role}" holds no permissions in the "${context}" context.`);
  return bundle;
}

const cell = (text) => String(text ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();

export function renderBlock(catalog, context, role) {
  const rows = bundleFor(catalog, context, role).map(
    (p) => `| **${cell(p.label)}** | ${cell(p.description)} | ${reachFor(p, role, context)} |`
  );
  return [
    '_Generated from the platform permission catalog. Edit the catalog, not this table — run `npm run docs:permissions` to refresh it._',
    '',
    '| Permission | What it allows | Reach |',
    '|---|---|---|',
    ...rows,
  ].join('\n');
}

const BEGIN = /<!-- BEGIN permissions: ([a-z]+)(?::([a-z_]+))? -->/g;
const END = '<!-- END permissions -->';

/**
 * Rewrites every marked block in `markdown`. Returns the new text, whether it
 * differs, and how many blocks it found. Throws (rather than skipping) on a
 * BEGIN with no END or a marker the catalog can't satisfy, because a guide that
 * silently stops updating is exactly the drift this exists to prevent.
 */
export function applyBlocks(markdown, catalog) {
  const crlf = markdown.includes('\r\n');
  const source = crlf ? markdown.replace(/\r\n/g, '\n') : markdown;

  let out = '';
  let cursor = 0;
  let blocks = 0;
  BEGIN.lastIndex = 0;
  let m;
  while ((m = BEGIN.exec(source))) {
    const contentStart = m.index + m[0].length;
    const endAt = source.indexOf(END, contentStart);
    if (endAt < 0) throw new Error(`"${m[0]}" has no matching "${END}".`);
    const context = m[1];
    const role = m[2] ?? null;
    out += source.slice(cursor, contentStart) + '\n' + renderBlock(catalog, context, role) + '\n';
    cursor = endAt;
    BEGIN.lastIndex = endAt + END.length;
    blocks += 1;
  }
  if (blocks === 0) return { text: markdown, changed: false, blocks: 0 };

  out += source.slice(cursor);
  const changed = out !== source;
  return { text: crlf ? out.replace(/\n/g, '\r\n') : out, changed, blocks };
}
