import { redirect } from 'next/navigation';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';

export default async function PlayerHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const dulaUser = await getCurrentDulaUser();
  if (!dulaUser) redirect('/');

  const { data: player } = await supabase
    .from('players')
    .select('id, name, jersey, position, age, team_id, teams(id, name, club_id, clubs(name))')
    .eq('user_id', dulaUser.id)
    .maybeSingle();

  if (!player) {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 420 }}>
          <div className="page-header"><h1>No player account linked</h1></div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            This page is for linked players. Ask your club (or your guardian) to link your account.
          </p>
        </div>
      </main>
    );
  }

  const team = (player as any).teams;

  const { data: upcomingSessions } = await supabase
    .from('training_sessions')
    .select('id, starts_at, ends_at, status')
    .eq('team_id', player.team_id)
    .eq('status', 'scheduled')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(10);

  const { data: attendanceHistory } = await supabase
    .from('attendance')
    .select('id, status, training_sessions(starts_at)')
    .eq('player_id', player.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: fees } = await supabase
    .from('fee_charges')
    .select('id, fee_type, amount, currency, status, due_date')
    .eq('player_id', player.id)
    .order('due_date');

  const { data: announcements } = player.team_id
    ? await supabase
        .from('announcements')
        .select('id, title, body, pinned, created_at')
        .eq('audience', 'team')
        .eq('team_id', player.team_id)
        .order('created_at', { ascending: false })
        .limit(8)
    : { data: [] };

  const ATTENDANCE_STYLE: Record<string, React.CSSProperties> = {
    present: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' },
    absent: { color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'var(--danger-soft-border)' },
    late: { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' },
    excused: { color: 'var(--blue)', background: 'var(--blue-soft)', borderColor: 'var(--blue-soft-border)' },
  };

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>{player.name}</h1>
            <p className="subtitle">
              {team?.name ?? 'No team'} · {team?.clubs?.name ?? ''}
              {player.jersey ? ` · #${player.jersey}` : ''}
              {player.position ? ` · ${player.position}` : ''}
            </p>
          </div>
        </div>

        <div className="section-label">Upcoming training</div>
        <div className="card">
          {(!upcomingSessions || upcomingSessions.length === 0) && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing scheduled.</p>
          )}
          {upcomingSessions?.map((s) => (
            <div key={s.id} className="list-row">
              <span className="list-row-title">
                {new Date(s.starts_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                {' · '}
                {new Date(s.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>

        <div className="section-label" style={{ marginTop: 24 }}>My attendance</div>
        <div className="card">
          {(!attendanceHistory || attendanceHistory.length === 0) && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No attendance recorded yet.</p>
          )}
          {attendanceHistory?.map((a: any) => (
            <div key={a.id} className="list-row">
              <span className="list-row-title">
                {a.training_sessions?.starts_at
                  ? new Date(a.training_sessions.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : '—'}
              </span>
              <span className="chip" style={ATTENDANCE_STYLE[a.status]}>{a.status.replace('_', ' ')}</span>
            </div>
          ))}
        </div>

        {(fees ?? []).length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 24 }}>Fees</div>
            <div className="card">
              {fees!.map((f) => (
                <div key={f.id} className="list-row">
                  <span className="list-row-title">{f.fee_type} — {f.currency} {Number(f.amount).toFixed(2)}</span>
                  <span className="chip">{f.status}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {(announcements ?? []).length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 24 }}>Team announcements</div>
            <div className="card">
              {announcements!.map((a) => (
                <div key={a.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                  <div className="list-row-title">{a.pinned && '📌 '}{a.title}</div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{a.body}</p>
                  <div className="list-row-meta">{new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
