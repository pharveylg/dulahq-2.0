import { redirect } from 'next/navigation';
import { createClient, getCurrentDulaUser, isPlatformAdmin } from '@/lib/supabase/server';

/**
 * Role-based landing router. Priority: platform admin / any club_staff /
 * any org_member -> /clubs (the staff app, unchanged); else an active
 * guardian -> /guardian; else a linked player -> /player; else a clear
 * "not linked" message rather than dumping them on /clubs to see an
 * empty, confusingly-worded page meant for staff.
 */
export default async function Home() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect('/login');

  if (await isPlatformAdmin()) redirect('/clubs');

  const dulaUser = await getCurrentDulaUser();
  if (!dulaUser) {
    // Signed in, but no public.users row at all -- not even a claimed
    // guardian yet (that claim runs in the root layout on the next
    // request, so by the time we're here it should normally have run;
    // this is the genuinely-unlinked case).
    return notLinked();
  }

  // A staff member (any role) with access to exactly one club shouldn't
  // have to pick it from a list of one -- land them straight on that
  // club's dashboard. Anyone with more than one club (or none yet) still
  // goes to /clubs, since there's a real choice to make there.
  const { data: staffRows } = await supabase.from('club_staff').select('club_id, clubs(slug)').eq('user_id', dulaUser.id);
  if (staffRows && staffRows.length > 0) {
    const distinctClubs = [...new Map(staffRows.map((s: any) => [s.club_id, s.clubs?.slug])).entries()];
    if (distinctClubs.length === 1 && distinctClubs[0][1]) redirect(`/clubs/${distinctClubs[0][1]}`);
    redirect('/clubs');
  }

  const { data: orgRow } = await supabase.from('org_members').select('org_id').ilike('email', authUser.email!).limit(1).maybeSingle();
  if (orgRow) redirect('/clubs');

  const { data: guardianRow } = await supabase
    .from('guardians')
    .select('id')
    .eq('user_id', dulaUser.id)
    .eq('account_status', 'active')
    .limit(1)
    .maybeSingle();
  if (guardianRow) redirect('/guardian');

  const { data: playerRow } = await supabase.from('players').select('id').eq('user_id', dulaUser.id).limit(1).maybeSingle();
  if (playerRow) redirect('/player');

  return notLinked();
}

function notLinked() {
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 420 }}>
        <div className="page-header">
          <h1>No access yet</h1>
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
          Your account isn’t linked to a club, guardian, or player record yet. Ask your club to add
          you as staff, invite you as a guardian, or link a player account to you.
        </p>
      </div>
    </main>
  );
}
