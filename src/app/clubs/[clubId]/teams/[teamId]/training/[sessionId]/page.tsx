import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient, getClubAccess, getAssignedTeamIds } from '@/lib/supabase/server';
import AttendanceRow from './AttendanceRow';

export default async function SessionAttendancePage({
  params,
}: {
  params: Promise<{ clubId: string; teamId: string; sessionId: string }>;
}) {
  const { clubId, teamId, sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: team } = await supabase.from('teams').select('id, name, club_id').eq('id', teamId).maybeSingle();
  if (!team || team.club_id !== clubId) notFound();

  const { data: session, error: sessionError } = await supabase
    .from('training_sessions')
    .select('id, starts_at, ends_at, status, notes, team_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError) {
    return (
      <main className="page">
        <div className="container">
          <p className="error-text">Couldn&apos;t load this session: {sessionError.message}</p>
        </div>
      </main>
    );
  }
  if (!session || session.team_id !== teamId) notFound();

  const access = await getClubAccess(clubId);
  const assignedTeamIds = access.isClubAdmin ? [] : await getAssignedTeamIds();
  const canManage = access.isClubAdmin || assignedTeamIds.includes(teamId);

  const { data: players } = await supabase.from('players').select('id, name').eq('team_id', teamId).order('name');
  const { data: attendanceRows } = await supabase
    .from('attendance')
    .select('player_id, status')
    .eq('training_session_id', sessionId);

  const statusByPlayer = new Map((attendanceRows ?? []).map((a) => [a.player_id, a.status]));

  const start = new Date(session.starts_at);
  const dateStr = start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <main className="page">
      <div className="container">
        <Link href={`/clubs/${clubId}/teams/${teamId}`} className="back-link">← {team.name}</Link>

        <div className="page-header">
          <div>
            <h1>Training — {dateStr}</h1>
            <p className="subtitle">
              {timeStr} · <span className="chip">{session.status}</span>
              {session.notes ? ` · ${session.notes}` : ''}
            </p>
          </div>
        </div>

        <div className="card">
          {(!players || players.length === 0) && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No players on this team yet.</p>
          )}
          {players?.map((p) => (
            <AttendanceRow
              key={p.id}
              clubId={clubId}
              teamId={teamId}
              sessionId={sessionId}
              playerId={p.id}
              playerName={p.name}
              initialStatus={(statusByPlayer.get(p.id) as any) ?? 'no_response'}
              canManage={canManage}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
