// Single source of truth for the RBAC showcase demo accounts (`/demo`), shared
// between the client-side persona picker (DemoPersonas.tsx) and server-rendered
// surfaces that need to label a signed-in demo account (the root nav chip,
// `/clubs`' "Signed in as X" line) -- one list, not two copies that can drift.
//
// Detection is by email domain: every demo account this app has ever seeded
// uses @dulahq-showcase.local consistently (scripts/seed-showcase-demo.mjs),
// so `isDemoEmail`/`getDemoPersonaLabel` need no separate "is this a demo
// account" flag anywhere.

export type Product = 'club' | 'tournament';

export type Persona = {
  email: string;
  role: string;
  name: string;
  description: string;
  destination: (clubSlug: string) => string;
  /** Which product entitlement(s) this role's access comes from. A role listed
   * under both is genuinely shared -- e.g. an org admin's authority spans
   * whatever entitlements their org holds, not one product's staff table. */
  products: Product[];
};

export const DEMO_EMAIL_DOMAIN = '@dulahq-showcase.local';

export const PERSONAS: Persona[] = [
  {
    email: 'orgadmin.usna-gali@dulahq-showcase.local',
    role: 'Org admin',
    name: 'Jose Bautista',
    description: 'Admin of Usna Gali (org_members), which holds both the club and tournament entitlements. Can create clubs and tournaments there, but isn’t automatically club or tournament staff at either.',
    destination: () => '/clubs',
    products: ['club', 'tournament'],
  },
  {
    email: 'clubadmin.usna-gali-fc@dulahq-showcase.local',
    role: 'Club manager',
    name: 'Juan Villanueva',
    description: 'The club’s business owner: rename it, add or remove staff, manage all three teams (U8, U15 Girls, U15 Boys), finances, membership. Cannot author development records or finalize a tournament roster — those are the coach’s.',
    destination: (clubSlug) => `/c/${clubSlug}`,
    products: ['club'],
  },
  {
    email: 'coach.u15-girls.usna-gali-fc@dulahq-showcase.local',
    role: 'Coach',
    name: 'Rodrigo Dagohoy',
    description: 'club_staff role=coach, assigned only to U15 Girls. Can’t see U8’s or U15 Boys’ roster, sessions, or evaluations at all.',
    destination: (clubSlug) => `/c/${clubSlug}/teams/u15-girls`,
    products: ['club'],
  },
  {
    email: 'teammanager.u15-girls.usna-gali-fc@dulahq-showcase.local',
    role: 'Team manager',
    name: 'Benigno Kintanar',
    description: 'Same team assignment as the coach account above (U15 Girls) — compare the two roles on the exact same roster. Runs operations (documents, membership, fee visibility for U15 Girls only) but cannot author evaluations, goals or private coach notes.',
    destination: (clubSlug) => `/c/${clubSlug}/teams/u15-girls`,
    products: ['club'],
  },
  {
    email: 'staff.u15-girls.usna-gali-fc@dulahq-showcase.local',
    role: 'Club admin (IT)',
    name: 'Luisa Villar',
    description: 'The technical administrator — club_it_admin. Holds no business permission at all: zero players, zero finances, zero teams. Can review the audit trail and start a logged “view as” session to troubleshoot someone’s access.',
    destination: (clubSlug) => `/c/${clubSlug}/it`,
    products: ['club'],
  },
  {
    email: 'demo-guardian.u15-girls.usna-gali-fc@dulahq-showcase.local',
    role: 'Guardian',
    name: 'Mylene Bautista',
    description: 'Guardian of a U15 Girls player. Sees that player’s fees, schedule, and evaluations — nothing about other players on the team.',
    destination: () => '/guardian',
    products: ['club'],
  },
  {
    email: 'demo-player.u15-girls.usna-gali-fc@dulahq-showcase.local',
    role: 'Player',
    name: 'Angelica Alvarado',
    description: 'Signed in as a U15 Girls player directly — the player-side counterpart to the guardian account above, same player.',
    destination: () => '/player',
    products: ['club'],
  },
  {
    email: 'organizer.tiger-cup.davao-unity-sports@dulahq-showcase.local',
    role: 'Tournament organizer',
    name: 'Dennis Manalo',
    description: 'Organizer of Tiger Cup at Davao Unity Sports, a tournament-only org. Belongs to no org and is not an org admin — everything comes from tournament_staff. Can accept or decline entries, add entries and categories and manage staff, but sees no club or player data and nothing at other tournaments.',
    destination: () => '/tm/davao-unity-sports/tiger-cup',
    products: ['tournament'],
  },
];

const PERSONA_BY_EMAIL = new Map(PERSONAS.map((p) => [p.email.toLowerCase(), p]));

export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN);
}

/** The role label to show for a signed-in account, with "(demo)" appended for a
 * known showcase persona. Falls back to the real account's own role/email for
 * everyone else, so this is safe to call unconditionally. */
export function getDisplayRole(email: string | null | undefined, fallbackRole: string | null | undefined): string | null {
  const persona = email ? PERSONA_BY_EMAIL.get(email.toLowerCase()) : undefined;
  if (persona) return `${persona.role} (demo)`;
  return fallbackRole ?? null;
}
