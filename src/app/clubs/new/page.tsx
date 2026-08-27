import { redirect } from 'next/navigation';
import { createClient, getCurrentDulaUser, getClubCreatableOrgs } from '@/lib/supabase/server';
import NewClubForm from './NewClubForm';

export default async function NewClubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // This was missing before -- /clubs/new rendered the form even for
  // signed-out visitors, who'd only find out it doesn't work after
  // submitting and getting a confusing "not admin" error. Every other
  // page in this app gates on auth first; this one should too.
  if (!user) redirect('/login');

  const dulaUser = await getCurrentDulaUser();

  if (!dulaUser) {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 480 }}>
          <p className="error-text">
            Your account isn&apos;t linked to a Dula HQ user yet — ask an
            admin to add you before you can create a club.
          </p>
        </div>
      </main>
    );
  }

  // Gate on the same set of orgs the clubs.org_id insert RLS actually
  // allows (platform admin, or org admin via org_members) -- not the
  // legacy public.users.role check, which knows nothing about orgs.
  const orgs = await getClubCreatableOrgs();

  if (orgs.length === 0) {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 480 }}>
          <p className="error-text">
            You need to be an admin of at least one organization (or a
            platform admin) to create a club.
          </p>
        </div>
      </main>
    );
  }

  return <NewClubForm orgs={orgs} />;
}
