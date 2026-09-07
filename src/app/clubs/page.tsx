import Link from 'next/link';
import { createClient, getCurrentDulaUser, getClubCreatableOrgs, isPlatformAdmin } from '@/lib/supabase/server';
import DemoDataControls from './DemoDataControls';
import ClubList from './ClubList';
import PublicClubList from './PublicClubList';

/**
 * Guests get the public directory (§6.C) -- clubs that opted into
 * publicly_listed, via the same public_clubs view the proxied tournament
 * app's directory pattern mirrors. Signed-in staff get the existing
 * "my clubs" management console unchanged below.
 */
async function GuestClubsPage() {
  const supabase = await createClient();
  const { data: clubs, error } = await supabase
    .from('public_clubs')
    .select('slug, name, location, org_name')
    .order('name');

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Clubs</h1>
            <p className="subtitle">Browse public clubs, or sign in to manage your own.</p>
          </div>
        </div>

        {error && <p className="error-text">Couldn&apos;t load clubs: {error.message}</p>}

        {!error && (!clubs || clubs.length === 0) && (
          <div className="card empty-state">
            <p>No clubs are publicly listed yet.</p>
          </div>
        )}

        {clubs && clubs.length > 0 && (
          <PublicClubList
            // public_clubs is a view, so PostgREST can't see that
            // clubs.slug/name and organizations.name (joined) are all
            // NOT NULL at the base-table level -- filter defensively
            // rather than assert, since a broken link is worse than a
            // skipped row if that guarantee is ever wrong.
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
      </div>
    </main>
  );
}

export default async function ClubsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <GuestClubsPage />;

  const dulaUser = await getCurrentDulaUser();

  // clubs' own RLS ("clubs readable within org") already scopes this list
  // to the caller's org(s) + platform admin -- no extra filtering needed
  // here, it's just reflecting what the DB already restricted.
  const { data: clubs, error } = await supabase
    .from('clubs')
    .select('id, slug, name, created_at, organizations(name), club_staff(count), teams(count)')
    .order('created_at', { ascending: false });

  // Same set the clubs.org_id insert RLS allows -- not the legacy
  // public.users.role check, which knows nothing about orgs.
  const canCreateClub = (await getClubCreatableOrgs()).length > 0;

  const platformAdmin = await isPlatformAdmin();
  const { data: demoOrg } = platformAdmin
    ? await supabase.from('organizations').select('id').eq('slug', 'dula-demo').maybeSingle()
    : { data: null };

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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {platformAdmin && (
              <Link href="/clubs/platformconsole" className="btn">
                Platform console
              </Link>
            )}
            {canCreateClub && (
              <Link href="/clubs/new" className="btn btn-primary">
                New club
              </Link>
            )}
          </div>
        </div>

        {platformAdmin && <DemoDataControls hasDemoData={!!demoOrg} />}

        {error && <p className="error-text">Couldn&apos;t load clubs: {error.message}</p>}

        {!error && (!clubs || clubs.length === 0) && (
          <div className="card empty-state">
            <p>No clubs yet.</p>
            {canCreateClub ? (
              <Link href="/clubs/new" className="btn btn-primary">Create the first club</Link>
            ) : (
              <p style={{ fontSize: 13 }}>You need to be an admin of an organization (or a platform admin) to create a club.</p>
            )}
          </div>
        )}

        {clubs && clubs.length > 0 && (
          <ClubList
            clubs={clubs.map((club: any) => ({
              id: club.id,
              slug: club.slug,
              name: club.name,
              orgName: club.organizations?.name ?? 'Unknown org',
              staffCount: club.club_staff?.[0]?.count ?? 0,
              teamCount: club.teams?.[0]?.count ?? 0,
            }))}
          />
        )}
      </div>
    </main>
  );
}
