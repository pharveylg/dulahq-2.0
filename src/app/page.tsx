import Link from 'next/link';
import Reveal from '@/components/motion/Reveal';
import Spotlight from '@/components/motion/Spotlight';
import { createClient } from '@/lib/supabase/server';
import PublicClubList from './clubs/PublicClubList';
import PublicTournamentList from './tournaments/PublicTournamentList';

/**
 * Public home page (§6.C) -- identical for everyone, guests included. No
 * role-based redirect: context comes from the URL a person lands on or
 * chooses, not from who's signed in.
 *
 * Fused with the public directories (previously a click through to /clubs
 * or /tournaments) so the first thing anyone sees is what's actually on
 * the platform, not two empty-feeling nav cards -- the same public_clubs /
 * public_tournaments views those pages query, side by side. Both routes
 * still work as direct links (and /clubs still carries the full staff
 * console once signed in); this just stops guests from having to click
 * through to see there's anything here.
 */
export default async function Home() {
  const supabase = await createClient();

  const [{ data: clubs, error: clubsError }, { data: tournaments, error: tournamentsError }] = await Promise.all([
    supabase.from('public_clubs').select('slug, name, location, org_name').order('name'),
    supabase
      .from('public_tournaments')
      .select('slug, name, poster_url, event_date, venue, org_slug, org_name')
      .order('event_date', { ascending: false }),
  ]);

  return (
    <main className="page" style={{ position: 'relative', overflow: 'hidden' }}>
      <Spotlight />
      <div className="container" style={{ position: 'relative' }}>
        <Reveal>
          <div className="page-header" style={{ display: 'block', textAlign: 'center', marginBottom: 12 }}>
            <h1 style={{ fontSize: 32 }}>Dulà HQ</h1>
            <p className="subtitle" style={{ marginTop: 8, fontSize: 15 }}>
              Run a club, or run a tournament.
            </p>
          </div>
        </Reveal>

        <Reveal index={1}>
          <p style={{ textAlign: 'center', marginBottom: 36, fontSize: 12.5, color: 'var(--text-muted)' }}>
            New here? <Link href="/demo">Try it as any role</Link> — one click, no account needed.
          </p>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 32,
          }}
        >
          <Reveal index={2}>
            <h2 style={{ fontSize: 20, marginBottom: 4 }}>Clubs</h2>
            <p className="subtitle" style={{ marginBottom: 14 }}>
              Browse public clubs, or sign in to manage your own.
            </p>
            {clubsError && <p className="error-text">Couldn&apos;t load clubs: {clubsError.message}</p>}
            {!clubsError && (!clubs || clubs.length === 0) && (
              <div className="card empty-state">
                <p>No clubs are publicly listed yet.</p>
              </div>
            )}
            {clubs && clubs.length > 0 && (
              <PublicClubList
                clubs={clubs
                  .filter((club): club is typeof club & { slug: string; name: string; org_name: string } =>
                    !!club.slug && !!club.name && !!club.org_name
                  )
                  .map((club) => ({
                    slug: club.slug,
                    name: club.name,
                    orgName: club.org_name,
                    location: club.location,
                  }))}
              />
            )}
          </Reveal>

          <Reveal index={3}>
            <h2 style={{ fontSize: 20, marginBottom: 4 }}>Tournaments</h2>
            <p className="subtitle" style={{ marginBottom: 14 }}>
              Browse public tournaments, or sign in to manage your own.
            </p>
            {tournamentsError && <p className="error-text">Couldn&apos;t load tournaments: {tournamentsError.message}</p>}
            {!tournamentsError && (!tournaments || tournaments.length === 0) && (
              <div className="card empty-state">
                <p>No tournaments are publicly listed yet.</p>
              </div>
            )}
            {tournaments && tournaments.length > 0 && (
              <PublicTournamentList
                tournaments={tournaments
                  .filter(
                    (t): t is typeof t & { slug: string; name: string; org_slug: string; org_name: string } =>
                      !!t.slug && !!t.name && !!t.org_slug && !!t.org_name
                  )
                  .map((t) => ({
                    slug: t.slug,
                    name: t.name,
                    posterUrl: t.poster_url,
                    eventDate: t.event_date,
                    venue: t.venue,
                    orgSlug: t.org_slug,
                    orgName: t.org_name,
                  }))}
              />
            )}
          </Reveal>
        </div>
      </div>
    </main>
  );
}
