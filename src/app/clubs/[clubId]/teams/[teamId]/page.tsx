import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';
import AddPlayerForm from './AddPlayerForm';
import PlayerRow from './PlayerRow';
import TrainingSessions from './TrainingSessions';

export default async function TeamRosterPage({
  params,
}: {
  params: Promise<{ clubId: string; teamId: string }>;
}) {
  const { clubId, teamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const dulaUser = await getCurrentDulaUser();

  const { data: club } = await supabase.from('clubs').select('id, name').eq('id', clubId).maybeSingle();
  if (!club) notFound();

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id, name, club_id')
    .eq('id', teamId)
    .maybeSingle();

  if (teamError) {
    return (
      <main className="page">
        <div className="container">
          <p className="error-text">Couldn&apos;t load this team: {teamError.message}</p>
        </div>
      </main>
    );
  }
  if (!team || team.club_id !== clubId) notFound();

  // Any club_staff role (not just club_admin) can manage players/guardians
  // -- matches the RLS added for players/guardians/player_guardians, which
  // gates on is_club_staff(), not is_club_admin().
  const { data: myStaffRow } = dulaUser
    ? await supabase.from('club_staff').select('role').eq('club_id', clubId).eq('user_id', dulaUser.id).maybeSingle()
    : { data: null };
  const canManage = dulaUser?.role === 'admin' || !!myStaffRow;

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select(
      'id, name, jersey, position, age,' +
      ' player_guardians(id, relationship, is_primary_contact, guardians(id, name, contact_info)),' +
      ' fee_charges(id, fee_type, amount, currency, status, due_date, payments(id, amount, method, paid_at))'
    )
    .eq('team_id', teamId)
    .order('name');

  const rosterPlayers = (players ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    jersey: p.jersey,
    position: p.position,
    age: p.age,
    guardians: (p.player_guardians ?? []).map((pg: any) => ({
      linkId: pg.id,
      guardianId: pg.guardians?.id,
      name: pg.guardians?.name ?? 'Unknown',
      relationship: pg.relationship,
      isPrimaryContact: pg.is_primary_contact,
      contactInfo: pg.guardians?.contact_info ?? null,
    })),
    fees: (p.fee_charges ?? []).map((fc: any) => ({
      id: fc.id,
      feeType: fc.fee_type,
      amount: Number(fc.amount),
      currency: fc.currency,
      status: fc.status,
      dueDate: fc.due_date,
      payments: (fc.payments ?? []).map((pay: any) => ({ ...pay, amount: Number(pay.amount) })),
    })),
  }));

  const { data: sessions, error: sessionsError } = await supabase
    .from('training_sessions')
    .select('id, starts_at, ends_at, status, notes, attendance(count)')
    .eq('team_id', teamId)
    .order('starts_at', { ascending: false });

  const trainingSessions = (sessions ?? []).map((s: any) => ({
    id: s.id,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    status: s.status,
    notes: s.notes,
    attendanceTaken: s.attendance?.[0]?.count ?? 0,
  }));

  return (
    <main className="page">
      <div className="container">
        <Link href={`/clubs/${clubId}`} className="back-link">← {club.name}</Link>

        <div className="page-header">
          <div>
            <h1>{team.name}</h1>
            <p className="subtitle">{rosterPlayers.length} player{rosterPlayers.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        {playersError && <p className="error-text">Couldn&apos;t load the roster: {playersError.message}</p>}

        <div className="card">
          {rosterPlayers.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No players yet.</p>
          )}
          {rosterPlayers.map((p) => (
            <PlayerRow key={p.id} clubId={clubId} teamId={teamId} player={p} canManage={canManage} />
          ))}
          {canManage ? (
            <AddPlayerForm clubId={clubId} teamId={teamId} />
          ) : (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16 }}>
              Only club staff or a platform admin can manage this roster.
            </p>
          )}
        </div>

        <div className="section-label" style={{ marginTop: 28 }}>
          Training sessions ({trainingSessions.length})
        </div>
        {sessionsError && <p className="error-text">Couldn&apos;t load training sessions: {sessionsError.message}</p>}
        <TrainingSessions clubId={clubId} teamId={teamId} sessions={trainingSessions} canManage={canManage} />
      </div>
    </main>
  );
}
