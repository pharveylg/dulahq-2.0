import Link from 'next/link';
import Reveal from '@/components/motion/Reveal';
import Spotlight from '@/components/motion/Spotlight';
import { createClient, getMyOrgProductAccess } from '@/lib/supabase/server';
import { loadPublicClubs, loadPublicTournaments } from '@/lib/public-directory';
import { CourtIcon } from '@/components/directory/DirectoryArt';
import PublicClubList from './clubs/PublicClubList';
import PublicTournamentList from './tournaments/PublicTournamentList';

/**
 * Guest-and-no-org home page: the public directory, so the first thing anyone
 * sees is what's actually on the platform. Clubs are logo tiles, tournaments
 * are poster cards, and Courts -- its own app -- is a strip that links out.
 * The same loaders and list components drive /clubs and /tournaments. Also
 * what a signed-in user with no org membership sees -- there's nothing of their
 * own to show them yet, so they get exactly what a guest gets.
 */
async function PublicDirectory() {
  const supabase = await createClient();

  const [{ clubs, error: clubsError }, { tournaments, error: tournamentsError }] = await Promise.all([
    loadPublicClubs(supabase),
    loadPublicTournaments(supabase),
  ]);

  return (
    <>
      <Reveal index={1}>
        <p style={{ textAlign: 'center', marginBottom: 36, fontSize: 12.5, color: 'var(--text-muted)' }}>
          New here? <Link href="/demo">Try it as any role</Link> — one click, no account needed.
        </p>
      </Reveal>

      <section style={{ marginBottom: 40 }}>
        <Reveal index={2}>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>Clubs</h2>
          <p className="subtitle" style={{ marginBottom: 14 }}>
            Browse public clubs, or sign in to manage your own.
          </p>
        </Reveal>
        {clubsError && <p className="error-text">Couldn&apos;t load clubs: {clubsError}</p>}
        {!clubsError && clubs.length === 0 && (
          <div className="card empty-state">
            <p>No clubs are publicly listed yet.</p>
          </div>
        )}
        {clubs.length > 0 && <PublicClubList clubs={clubs} />}
      </section>

      <section style={{ marginBottom: 40 }}>
        <Reveal index={3}>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>Tournaments</h2>
          <p className="subtitle" style={{ marginBottom: 14 }}>
            Browse public tournaments, or sign in to manage your own.
          </p>
        </Reveal>
        {tournamentsError && <p className="error-text">Couldn&apos;t load tournaments: {tournamentsError}</p>}
        {!tournamentsError && tournaments.length === 0 && (
          <div className="card empty-state">
            <p>No tournaments are publicly listed yet.</p>
          </div>
        )}
        {tournaments.length > 0 && <PublicTournamentList tournaments={tournaments} />}
      </section>

      <section>
        <Reveal index={4}>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>Courts</h2>
          <p className="subtitle" style={{ marginBottom: 14 }}>
            Book a court, or join the walk-in queue.
          </p>
          <a href={COURTS_URL} className="dir-strip">
            <CourtIcon size={44} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="dir-name" style={{ marginTop: 0 }}>Court booking</span>
              <span className="dir-meta">{COURTS_DESCRIPTION}</span>
            </span>
            <span className="chip">Open courts.dulahq.app →</span>
          </a>
        </Reveal>
      </section>
    </>
  );
}

// Court booking is its own app on its own subdomain (not a route here), so it
// is a plain link out. It has no entitlement in org_entitlements, so unlike
// Clubs and Tournaments it is offered to everyone.
const COURTS_URL = 'https://courts.dulahq.app';
const COURTS_DESCRIPTION = 'Reserve pickleball court time, join the walk-in queue, and follow live scores.';

function ProductTile({
  title,
  description,
  href,
  enabled,
  guestHref,
  external,
}: {
  title: string;
  description: string;
  href: string;
  enabled: boolean;
  guestHref: string;
  external?: boolean;
}) {
  if (enabled && external) {
    return (
      <a href={href} className="card" style={{ display: 'block', textDecoration: 'none', height: '100%' }}>
        <h2 style={{ fontSize: 19, marginBottom: 8 }}>{title}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{description}</p>
      </a>
    );
  }
  if (enabled) {
    return (
      <Link href={href} className="card" style={{ display: 'block', textDecoration: 'none', height: '100%' }}>
        <h2 style={{ fontSize: 19, marginBottom: 8 }}>{title}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{description}</p>
      </Link>
    );
  }
  return (
    <div className="card" style={{ height: '100%', opacity: 0.7 }}>
      <h2 style={{ fontSize: 19, marginBottom: 8 }}>{title}</h2>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 10 }}>
        This feature is not enabled for your org.
      </p>
      <Link href={guestHref} style={{ fontSize: 13 }}>View as guest →</Link>
    </div>
  );
}

/**
 * A signed-in user whose org(s) have at least one product: both Clubs and
 * Tournaments always show as tiles (per the platform-console consolidation
 * work) -- the entitled one links to that product's own dashboard, the
 * other explains why it's unavailable and offers the same public view a
 * guest gets instead of just hiding it or silently 404ing.
 */
function OrgHome({ access }: { access: { club: boolean; tournament: boolean; tournamentOrgSlug: string | null } }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 20,
        maxWidth: 1000,
        margin: '0 auto',
      }}
    >
      <Reveal index={1}>
        <ProductTile
          title="Clubs"
          description="Rosters, teams, staff, fees, and everything a club runs day to day."
          href="/clubs"
          enabled={access.club}
          guestHref="/clubs"
        />
      </Reveal>
      <Reveal index={2}>
        <ProductTile
          title="Tournaments"
          description="Brackets, groups, live scoring, and registration."
          href={access.tournamentOrgSlug ? `/t/${access.tournamentOrgSlug}` : '/tournaments'}
          enabled={access.tournament}
          guestHref="/tournaments"
        />
      </Reveal>
      <Reveal index={3}>
        <ProductTile
          title="Courts"
          description={COURTS_DESCRIPTION}
          href={COURTS_URL}
          enabled
          external
          guestHref={COURTS_URL}
        />
      </Reveal>
    </div>
  );
}

/**
 * Public home page (§6.C) -- identical for guests and for a signed-in user
 * with no org. A signed-in user who belongs to at least one org gets a
 * different view instead (OrgHome): what their own org can actually do,
 * not the whole platform's public directory. Context still comes from the
 * URL/session, never a role-based redirect away from '/'.
 */
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const access = user ? await getMyOrgProductAccess() : null;
  const hasOrg = !!(access && (access.club || access.tournament));

  return (
    <main className="page" style={{ position: 'relative', overflow: 'hidden' }}>
      <Spotlight />
      <div className="container" style={{ position: 'relative' }}>
        <Reveal>
          <div className="page-header" style={{ display: 'block', textAlign: 'center', marginBottom: 12 }}>
            <h1 style={{ fontSize: 32 }}>Dulà HQ</h1>
            <p className="subtitle" style={{ marginTop: 8, fontSize: 15 }}>
              Run a club, run a tournament, or book a court.
            </p>
          </div>
        </Reveal>

        {hasOrg && access ? <OrgHome access={access} /> : <PublicDirectory />}
      </div>
    </main>
  );
}
