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
    email: 'demo-platformadmin@dulahq-demo.local',
    role: 'Platform admin',
    name: 'Priya Admin',
    description: 'Sees every org, club, and tournament on the platform. Can open the platform console.',
    destination: () => '/platformconsole',
  },
  {
    email: 'demo-orgadmin@dulahq-demo.local',
    role: 'Org admin',
    name: 'Omar Rivera',
    description: 'Admin of the Dula HQ Demo org (org_members). Can create clubs/tournaments there, but isn’t automatically club staff anywhere.',
    destination: () => '/clubs',
  },
  {
    email: 'demo-clubadmin@dulahq-demo.local',
    role: 'Club admin',
    name: 'Carla Bennett',
    description: 'Full control of the demo club: rename it, add or remove staff, manage both teams, finances, everything.',
    destination: (clubSlug) => `/c/${clubSlug}`,
  },
  {
    email: 'demo-coach@dulahq-demo.local',
    role: 'Coach',
    name: 'Coach Dana Wells',
    description: 'club_staff role=coach, assigned only to Demo U12. Can’t see Demo U15’s roster, sessions, or evaluations at all.',
    destination: (clubSlug) => `/c/${clubSlug}/teams/demo-u12`,
  },
  {
    email: 'demo-teammanager@dulahq-demo.local',
    role: 'Team manager',
    name: 'Tariq Manager',
    description: 'Same shape as the coach account, but assigned to Demo U15 instead — compare the two for the exact same restriction on a different team.',
    destination: (clubSlug) => `/c/${clubSlug}/teams/demo-u15`,
  },
  {
    email: 'demo-staff@dulahq-demo.local',
    role: 'Staff',
    name: 'Sam Ito',
    description: 'club_staff role=staff, not assigned to any team. Can manage finances and reports club-wide, but can’t rename the club or manage other staff.',
    destination: (clubSlug) => `/c/${clubSlug}`,
  },
  {
    email: 'demo-guardian@dulahq-demo.local',
    role: 'Guardian',
    name: 'Grace Alvarez',
    description: 'Linked to Jordan Alvarez on Demo U12. Sees Jordan’s fees, schedule, and evaluations — nothing about other players.',
    destination: () => '/guardian',
  },
  {
    email: 'demo-player@dulahq-demo.local',
    role: 'Player',
    name: 'Jordan Alvarez',
    description: 'Signed in as Jordan directly — the player-side counterpart to the guardian account above, same player.',
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
