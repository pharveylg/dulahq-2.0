import Link from 'next/link';
import Reveal from '@/components/motion/Reveal';
import Spotlight from '@/components/motion/Spotlight';

/**
 * Public home page (§6.C) -- identical for everyone, guests included.
 * No role-based redirect: this used to dispatch signed-in users straight
 * to /clubs, /guardian or /player depending on who they were. Context now
 * comes from the URL a person lands on or chooses, not from who's signed
 * in -- a club shows its own overview or its full staff console depending
 * on access (see /clubs/[clubSlug]); a tournament shows its own guest or
 * registered view (the proxied Tournament Manager app already does this).
 */
export default function Home() {
  return (
    <main className="page" style={{ position: 'relative', overflow: 'hidden' }}>
      <Spotlight />
      <div className="container" style={{ position: 'relative' }}>
        <Reveal>
          <div className="page-header" style={{ display: 'block', textAlign: 'center', marginBottom: 40 }}>
            <h1 style={{ fontSize: 32 }}>Dulà HQ</h1>
            <p className="subtitle" style={{ marginTop: 8, fontSize: 15 }}>
              Run a club, or run a tournament.
            </p>
          </div>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
            maxWidth: 720,
            margin: '0 auto',
          }}
        >
          <Reveal index={1}>
            <Link href="/clubs" className="card" style={{ display: 'block', textDecoration: 'none', height: '100%' }}>
              <h2 style={{ fontSize: 19, marginBottom: 8 }}>Clubs</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
                Rosters, teams, staff, fees, and everything a club runs day to day.
              </p>
            </Link>
          </Reveal>
          <Reveal index={2}>
            <Link href="/tournaments" className="card" style={{ display: 'block', textDecoration: 'none', height: '100%' }}>
              <h2 style={{ fontSize: 19, marginBottom: 8 }}>Tournaments</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
                Brackets, groups, live scoring, and registration.
              </p>
            </Link>
          </Reveal>
        </div>

        <Reveal index={3}>
          <p style={{ textAlign: 'center', marginTop: 28, fontSize: 12.5, color: 'var(--text-muted)' }}>
            New here? <Link href="/demo">Try it as any role</Link> — one click, no account needed.
          </p>
        </Reveal>
      </div>
    </main>
  );
}
