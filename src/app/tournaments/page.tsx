import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PublicTournamentList from './PublicTournamentList';
import { loadPublicTournaments } from '@/lib/public-directory';

/**
 * Public tournament directory (§6.C), native to this app -- queries
 * public_tournaments directly per §5 rather than proxying to the
 * Tournament Manager app's own gallery, which only takes over once a
 * specific tournament (/t/:orgSlug/:tournamentSlug) is opened.
 */
export default async function TournamentsPage() {
  const supabase = await createClient();
  const { tournaments, error } = await loadPublicTournaments(supabase);

  // Tournaments this person staffs or administers -- the way in to the native
  // organizer console at /tm. Empty for guests and for everyone who only
  // browses.
  const { data: { user } } = await supabase.auth.getUser();
  const { data: managed } = user ? await supabase.rpc('my_manageable_tournaments') : { data: [] };

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Tournaments</h1>
            <p className="subtitle">Browse public tournaments, or sign in to manage your own.</p>
          </div>
        </div>

        {managed && managed.length > 0 && (
          <>
            <div className="section-label">Tournaments you manage</div>
            <div className="card" style={{ marginBottom: 24 }}>
              {managed.map((t) => (
                <Link key={t.tournament_id} href={`/tm/${t.org_slug}/${t.tournament_slug}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="list-row-main">
                    <div className="list-row-title">{t.tournament_name}</div>
                    <div className="list-row-meta">{t.org_name}</div>
                  </div>
                  <span className="chip">Manage</span>
                </Link>
              ))}
            </div>
          </>
        )}

        {error && <p className="error-text">Couldn&apos;t load tournaments: {error}</p>}

        {!error && tournaments.length === 0 && (
          <div className="card empty-state">
            <p>No tournaments are publicly listed yet.</p>
          </div>
        )}

        {tournaments.length > 0 && <PublicTournamentList tournaments={tournaments} />}
      </div>
    </main>
  );
}
