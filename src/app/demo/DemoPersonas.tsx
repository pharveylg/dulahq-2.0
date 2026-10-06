'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Reveal from '@/components/motion/Reveal';
import { PERSONAS, type Product, type Persona } from '@/lib/demo-personas';

const DEMO_PASSWORD = 'DemoPass2026!';

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
      <details className="dir-section" style={{ marginBottom: 28 }}>
        <summary>
          <span className="dir-section-heading">
            <h2 style={{ fontSize: 16 }}>{title}</h2>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{subtitle}</span>
          </span>
          <span className="dir-section-chevron">▸</span>
        </summary>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 14,
            marginTop: 14,
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
      </details>
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
