'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Reveal from '@/components/motion/Reveal';

const DEMO_PASSWORD = 'DemoPass2026!';

type Product = 'club' | 'tournament';

type Persona = {
  email: string;
  role: string;
  name: string;
  description: string;
  destination: (clubSlug: string) => string;
  /** Which product entitlement(s) this role's access comes from. A role listed under
   * both is genuinely shared -- e.g. an org admin's authority spans whatever
   * entitlements their org holds, not one product's staff table. Platform admin isn't
   * here at all: it's not scoped to any org's entitlements, and a full-power account
   * has no business being a one-click button on an unauthenticated, possibly
   * prospect-facing page -- sign in with a real platform-admin login and open
   * /platformconsole directly instead. */
  products: Product[];
};

const PERSONAS: Persona[] = [
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

export default function DemoPersonas({ clubSlug }: { clubSlug: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInAs(persona: Persona) {
    setPending(persona.email);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: persona.email,
      password: DEMO_PASSWORD,
    });
    if (signInError) {
      setError(`Couldn’t sign in as ${persona.name}: ${signInError.message}`);
      setPending(null);
      return;
    }
    router.push(persona.destination(clubSlug));
    router.refresh();
  }

  function renderGroup(product: Product, title: string, subtitle: string) {
    const group = PERSONAS.filter((p) => p.products.includes(product));
    return (
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, marginBottom: 2 }}>{title}</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>{subtitle}</p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 14,
          }}
        >
          {group.map((persona, i) => (
            <Reveal key={`${product}-${persona.email}`} index={i}>
              <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span className="chip">{persona.role}</span>
                  {persona.products.length > 1 && (
                    <span className="chip" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                      Shared access — club + tournament
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>{persona.name}</div>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', flex: 1, marginBottom: 14 }}>
                  {persona.description}
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  disabled={pending !== null}
                  onClick={() => signInAs(persona)}
                >
                  {pending === persona.email ? 'Signing in…' : `Sign in as ${persona.role}`}
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      {renderGroup('club', 'Club Roles', 'Access comes from a club’s own staff table, or a family relationship to a player at one.')}
      {renderGroup('tournament', 'Tournament Roles', 'Access comes from a tournament’s own staff table, or the org that hosts it.')}
    </div>
  );
}
