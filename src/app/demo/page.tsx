import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import DemoPersonas from './DemoPersonas';

const CLUB_SLUG = 'dulahq-demo-club';
const ORG_SLUG = 'dulahq-rbac-demo';
const TOURNAMENT_SLUG = 'dulahq-demo-cup';

/**
 * Public, permanent RBAC demo -- one standing account per role, seeded by
 * scripts/seed-rbac-demo.mjs (not the ephemeral loadDemoData/wipeDemoData
 * pair on /clubs, which is a separate org and untouched by this). Anyone
 * can sign in as any persona here; the point is to make every role's
 * actual scope directly experienceable rather than described in the abstract.
 */
export default async function DemoPage() {
  const supabase = await createClient();
  const { data: club } = await supabase.from('public_clubs').select('name').eq('slug', CLUB_SLUG).maybeSingle();

  if (!club) {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 480 }}>
          <div className="page-header"><h1>Demo not seeded</h1></div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            The RBAC demo club/tournament and its accounts aren&apos;t currently
            in the database. Run <code>node scripts/seed-rbac-demo.mjs</code>{' '}
            to create them.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <div className="page-header" style={{ display: 'block' }}>
          <h1>Try Dulà HQ as any role</h1>
          <p className="subtitle" style={{ marginTop: 6, maxWidth: 640 }}>
            One standing demo club and tournament, one account per RBAC role. Pick a
            role below to sign in as that account directly — no password to remember.
            Everything you see is enforced by the same RLS policies as a real account,
            not a simulated view.
          </p>
        </div>

        <DemoPersonas clubSlug={CLUB_SLUG} />

        <div className="card" style={{ marginTop: 28 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Browse without signing in</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            The demo club and tournament are both publicly listed — this is what a
            guest (nobody signed in) sees.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/clubs/${CLUB_SLUG}`} className="btn">Demo club (guest view)</Link>
            <a href={`/t/${ORG_SLUG}/${TOURNAMENT_SLUG}`} className="btn">Demo tournament (guest view)</a>
          </div>
        </div>
      </div>
    </main>
  );
}
