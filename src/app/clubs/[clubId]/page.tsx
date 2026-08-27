import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';
import EditNameForm from './EditNameForm';
import AddStaffForm from './AddStaffForm';
import LinkTeamForm from './LinkTeamForm';
import StaffRow from './StaffRow';

export default async function ClubDetailPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const dulaUser = await getCurrentDulaUser();

  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .select('id, name, created_at')
    .eq('id', clubId)
    .maybeSingle();

  if (clubError) {
    return (
      <main className="page">
        <div className="container">
          <p className="error-text">Couldn&apos;t load this club: {clubError.message}</p>
        </div>
      </main>
    );
  }
  if (!club) notFound();

  // Is the current user club_admin here (or a platform admin)? Purely
  // for UI gating -- RLS is still the real enforcement.
  const { data: myStaffRow } = dulaUser
    ? await supabase
        .from('club_staff')
        .select('role')
        .eq('club_id', clubId)
        .eq('user_id', dulaUser.id)
        .maybeSingle()
    : { data: null };

  const canManage = dulaUser?.role === 'admin' || myStaffRow?.role === 'club_admin';

  const { data: staffRows } = await supabase
    .from('club_staff')
    .select('id, role, user_id, users(name, email)')
    .eq('club_id', clubId)
    .order('role');

  const { data: clubTeams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)
    .order('name');

  const { data: unclaimedTeams } = canManage
    ? await supabase.from('teams').select('id, name').is('club_id', null).order('name')
    : { data: [] };

  // Assigned-team lookups, per staff member with a coach/team_manager role.
  const relevantStaffUserIds = (staffRows ?? [])
    .filter((s) => s.role === 'coach' || s.role === 'team_manager')
    .map((s) => s.user_id);

  const { data: assignments } = relevantStaffUserIds.length
    ? await supabase
        .from('user_assigned_teams')
        .select('user_id, team_id')
        .in('user_id', relevantStaffUserIds)
    : { data: [] };

  const assignedTeamIdsByUser = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const list = assignedTeamIdsByUser.get(a.user_id) ?? [];
    list.push(a.team_id);
    assignedTeamIdsByUser.set(a.user_id, list);
  }

  return (
    <main className="page">
      <div className="container">
        <Link href="/clubs" className="back-link">← Clubs</Link>

        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1>{club.name}</h1>
            {canManage && <EditNameForm clubId={club.id} initialName={club.name} />}
          </div>
        </div>

        <div className="section-label">Teams ({clubTeams?.length ?? 0})</div>
        <div className="card">
          {(!clubTeams || clubTeams.length === 0) && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No teams linked yet.</p>
          )}
          {clubTeams?.map((t) => (
            <div key={t.id} className="list-row">
              <span className="list-row-title">{t.name}</span>
            </div>
          ))}
          {canManage && <LinkTeamForm clubId={club.id} unclaimedTeams={unclaimedTeams ?? []} />}
        </div>

        <div className="section-label" style={{ marginTop: 28 }}>
          Staff ({staffRows?.length ?? 0})
        </div>
        <div className="card">
          {(!staffRows || staffRows.length === 0) && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No staff added yet.</p>
          )}
          {staffRows?.map((s: any) => (
            <StaffRow
              key={s.id}
              clubId={club.id}
              staff={s}
              clubTeams={clubTeams ?? []}
              assignedTeamIds={assignedTeamIdsByUser.get(s.user_id) ?? []}
            />
          ))}
        </div>

        {canManage ? (
          <AddStaffForm clubId={club.id} />
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16 }}>
            Only club staff or a platform admin can manage this club.
          </p>
        )}
      </div>
    </main>
  );
}
