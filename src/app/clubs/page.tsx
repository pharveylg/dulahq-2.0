import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';

export default async function ClubsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const dulaUser = await getCurrentDulaUser();

  const { data: clubs, error } = await supabase
    .from('clubs')
    .select('id, name, created_at, club_staff(count), teams(count)')
    .order('created_at', { ascending: false });

  const canCreateClub = dulaUser?.role === 'admin';

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Clubs</h1>
            <p className="subtitle">
              {dulaUser
                ? `Signed in as ${dulaUser.role}`
                : 'Your account isn\u2019t linked to a Dula HQ user yet — ask an admin to add you.'}
            </p>
          </div>
          {canCreateClub && (
            <Link href="/clubs/new" className="btn btn-primary">
              New club
            </Link>
          )}
        </div>

        {error && <p className="error-text">Couldn&apos;t load clubs: {error.message}</p>}

        {!error && (!clubs || clubs.length === 0) && (
          <div className="card empty-state">
            <p>No clubs yet.</p>
            {canCreateClub ? (
              <Link href="/clubs/new" className="btn btn-primary">Create the first club</Link>
            ) : (
              <p style={{ fontSize: 13 }}>Only a platform admin can create the first club.</p>
            )}
          </div>
        )}

        {clubs && clubs.length > 0 && (
          <div className="card">
            {clubs.map((club: any) => (
              <Link
                key={club.id}
                href={`/clubs/${club.id}`}
                className="list-row"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="list-row-main">
                  <div className="list-row-title">{club.name}</div>
                  <div className="list-row-meta">
                    {club.club_staff?.[0]?.count ?? 0} staff · {club.teams?.[0]?.count ?? 0} teams
                  </div>
                </div>
                <span className="chip">View →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
