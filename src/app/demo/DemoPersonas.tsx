'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Reveal from '@/components/motion/Reveal';

const DEMO_PASSWORD = 'DemoPass2026!';

type Persona = {
  email: string;
  role: string;
  name: string;
  description: string;
  destination: (clubSlug: string) => string;
};

const PERSONAS: Persona[] = [
  {
    email: 'demo-platformadmin@dulahq-showcase.local',
    role: 'Platform admin',
    name: 'Queenie Alvarado',
    description: 'Sees every org, club, and tournament on the platform — all four showcase orgs, not just Usna Gali. Can open the platform console.',
    destination: () => '/platformconsole',
  },
  {
    email: 'orgadmin.usna-gali@dulahq-showcase.local',
    role: 'Org admin',
    name: 'Jose Bautista',
    description: 'Admin of Usna Gali (org_members). Can create clubs/tournaments there, but isn’t automatically club staff at either of its clubs.',
    destination: () => '/clubs',
  },
  {
    email: 'clubadmin.usna-gali-fc@dulahq-showcase.local',
    role: 'Club manager',
    name: 'Juan Villanueva',
    description: 'The club’s business owner: rename it, add or remove staff, manage all three teams (U8, U15 Girls, U15 Boys), finances, membership. Cannot author development records or finalize a tournament roster — those are the coach’s.',
    destination: (clubSlug) => `/c/${clubSlug}`,
  },
  {
    email: 'coach.u15-girls.usna-gali-fc@dulahq-showcase.local',
    role: 'Coach',
    name: 'Rodrigo Dagohoy',
    description: 'club_staff role=coach, assigned only to U15 Girls. Can’t see U8’s or U15 Boys’ roster, sessions, or evaluations at all.',
    destination: (clubSlug) => `/c/${clubSlug}/teams/u15-girls`,
  },
  {
    email: 'teammanager.u15-girls.usna-gali-fc@dulahq-showcase.local',
    role: 'Team manager',
    name: 'Benigno Kintanar',
    description: 'Same team assignment as the coach account above (U15 Girls) — compare the two roles on the exact same roster. Runs operations (documents, membership, fee visibility for U15 Girls only) but cannot author evaluations, goals or private coach notes.',
    destination: (clubSlug) => `/c/${clubSlug}/teams/u15-girls`,
  },
  {
    email: 'staff.u15-girls.usna-gali-fc@dulahq-showcase.local',
    role: 'Club admin (IT)',
    name: 'Luisa Villar',
    description: 'The technical administrator — club_it_admin. Holds no business permission at all: zero players, zero finances, zero teams. Can review the audit trail and start a logged “view as” session to troubleshoot someone’s access.',
    destination: (clubSlug) => `/c/${clubSlug}/it`,
  },
  {
    email: 'demo-guardian.u15-girls.usna-gali-fc@dulahq-showcase.local',
    role: 'Guardian',
    name: 'Mylene Bautista',
    description: 'Guardian of a U15 Girls player. Sees that player’s fees, schedule, and evaluations — nothing about other players on the team.',
    destination: () => '/guardian',
  },
  {
    email: 'demo-player.u15-girls.usna-gali-fc@dulahq-showcase.local',
    role: 'Player',
    name: 'Angelica Alvarado',
    description: 'Signed in as a U15 Girls player directly — the player-side counterpart to the guardian account above, same player.',
    destination: () => '/player',
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

  return (
    <div>
      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
        }}
      >
        {PERSONAS.map((persona, i) => (
          <Reveal key={persona.email} index={i}>
            <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <span className="chip" style={{ alignSelf: 'flex-start', marginBottom: 8 }}>{persona.role}</span>
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
