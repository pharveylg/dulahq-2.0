import { redirect } from 'next/navigation';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';
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

  if (dulaUser.role !== 'admin') {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 480 }}>
          <p className="error-text">
            Only a platform admin can create a club. Your role is &quot;{dulaUser.role}&quot;.
          </p>
        </div>
      </main>
    );
  }

  return <NewClubForm />;
}
