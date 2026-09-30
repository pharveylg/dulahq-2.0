import { redirect } from 'next/navigation';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';

const ROLE_LABEL: Record<string, string> = {
  referee: 'Referee',
  assistant_referee: 'Assistant referee',
  fourth_official: 'Fourth official',
  commissioner: 'Commissioner',
  table_official: 'Table official',
};

function formatDate(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * A linked official (org_officials.user_id) reads their own profile and
 * assignments directly under RLS's self-branches -- no permission bundle,
 * no console. Read-only: adding/editing an official, and assigning one to a
 * tournament, both stay staff-side actions in the organizer console.
 */
export default async function OfficialHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const dulaUser = await getCurrentDulaUser();
  if (!dulaUser) redirect('/');

  const { data: profiles } = await supabase
    .from('org_officials')
    .select('id, full_name, grade, designation, phone, email, availability, active, organizations(name)')
    .eq('user_id', dulaUser.id);

  if (!profiles || profiles.length === 0) {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 420 }}>
          <div className="page-header"><h1>Not linked as an official</h1></div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            This page is for officials linked to an account. Ask the tournament that lists you to link it.
          </p>
        </div>
      </main>
    );
  }

  const { data: assignments } = await (supabase as any).rpc('my_officiating_assignments');

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="page-header">
          <div>
            <h1>{profiles[0].full_name}</h1>
            <p className="subtitle" style={{ marginTop: 4 }}>Officiating profile and match assignments.</p>
          </div>
        </div>

        <div className="section-label">Profile</div>
        <div className="card" style={{ marginBottom: 24 }}>
          {profiles.map((p: any) => (
            <div key={p.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <div className="list-row-title">
                {p.organizations?.name ?? 'Unknown org'}{' '}
                <span className="chip" style={{ color: p.active ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {p.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="list-row-meta">
                {[p.designation, p.grade].filter(Boolean).join(' · ') || 'No designation on file'}
              </div>
              <div className="list-row-meta">
                {[p.phone, p.email].filter(Boolean).join(' · ') || 'No contact info on file'}
              </div>
              {p.availability && <div className="list-row-meta">Availability: {p.availability}</div>}
            </div>
          ))}
        </div>

        <div className="section-label">Assignments ({assignments?.length ?? 0})</div>
        <div className="card">
          {(!assignments || assignments.length === 0) && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No tournament assignments yet.</p>
          )}
          {(assignments ?? []).map((a: any) => (
            // Not a link to /t/<org>: that's the frozen Tournament Manager engine,
            // which resolves identity from org_members/club_staff only -- it has no
            // concept of a linked official at all, so following this link signed in
            // as one always dead-ends in "no tenant membership was found" there.
            <div key={`${a.tournament_id}-${a.role}`} className="list-row">
              <div className="list-row-main">
                <div className="list-row-title">{a.tournament_name}</div>
                <div className="list-row-meta">
                  {a.org_name}{formatDate(a.event_date) ? ` · ${formatDate(a.event_date)}` : ''}{a.venue ? ` · ${a.venue}` : ''}
                </div>
              </div>
              <span className="chip">{ROLE_LABEL[a.role] ?? a.role}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
