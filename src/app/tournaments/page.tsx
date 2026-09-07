import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PublicTournamentList from './PublicTournamentList';

/**
 * Public tournament directory (§6.C), native to this app -- queries
 * public_tournaments directly per §5 rather than proxying to the
 * Tournament Manager app's own gallery, which only takes over once a
 * specific tournament (/t/:orgSlug/:tournamentSlug) is opened.
 */
export default async function TournamentsPage() {
  const supabase = await createClient();
  const { data: tournaments, error } = await supabase
    .from('public_tournaments')
    .select('slug, name, poster_url, event_date, venue, org_slug, org_name')
    .order('event_date', { ascending: false });

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Tournaments</h1>
            <p className="subtitle">Browse public tournaments, or sign in to manage your own.</p>
          </div>
        </div>

        {error && <p className="error-text">Couldn&apos;t load tournaments: {error.message}</p>}

        {!error && (!tournaments || tournaments.length === 0) && (
          <div className="card empty-state">
            <p>No tournaments are publicly listed yet.</p>
          </div>
        )}

        {tournaments && tournaments.length > 0 && (
          <PublicTournamentList
            tournaments={tournaments.map((t) => ({
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
      </div>
    </main>
  );
}
