const ATTENDANCE_STYLE: Record<string, React.CSSProperties> = {
  present: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' },
  absent: { color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'var(--danger-soft-border)' },
  late: { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' },
  excused: { color: 'var(--blue)', background: 'var(--blue-soft)', borderColor: 'var(--blue-soft-border)' },
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  on_track: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' },
  needs_attention: { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' },
  excelling: { color: 'var(--blue)', background: 'var(--blue-soft)', borderColor: 'var(--blue-soft-border)' },
};

type ActiveGoal = { id: string; title: string; status: string; skillName: string | null };
type ActivityEntry = { date: string; kind: 'evaluation' | 'goal' | 'note' | 'training'; label: string };

export default function Overview({
  player,
  teamName,
  clubName,
  developmentStatus,
  attendancePct,
  sessionsAttended,
  sessionsMissed,
  activeGoals,
  latestEvaluationDate,
  upcomingSessions,
  recentActivity,
}: {
  player: { name: string; jersey: string | null; position: string | null; secondaryPosition: string | null; preferredFoot: string | null; dob: string | null };
  teamName: string | null;
  clubName: string | null;
  developmentStatus: string | null;
  attendancePct: number | null;
  sessionsAttended: number;
  sessionsMissed: number;
  activeGoals: ActiveGoal[];
  latestEvaluationDate: string | null;
  upcomingSessions: { id: string; starts_at: string }[];
  recentActivity: ActivityEntry[];
}) {
  const age = player.dob
    ? Math.floor((Date.now() - new Date(player.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {teamName ?? 'No team'}{clubName ? ` · ${clubName}` : ''}
          {player.jersey ? ` · #${player.jersey}` : ''}
          {[player.position, player.secondaryPosition && `/ ${player.secondaryPosition}`].filter(Boolean).join(' ') && (
            <> · {[player.position, player.secondaryPosition && `/ ${player.secondaryPosition}`].filter(Boolean).join(' ')}</>
          )}
          {player.preferredFoot ? ` · ${player.preferredFoot} footed` : ''}
          {age !== null ? ` · ${age}y` : ''}
        </div>
        {developmentStatus && (
          <span className="chip" style={STATUS_STYLE[developmentStatus]}>{developmentStatus.replace('_', ' ')}</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="card">
          <div className="section-label" style={{ fontSize: 11 }}>Training</div>
          {attendancePct !== null ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{attendancePct}%</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sessionsAttended} attended · {sessionsMissed} missed</div>
            </>
          ) : (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>No attendance recorded yet.</p>
          )}
        </div>
        <div className="card">
          <div className="section-label" style={{ fontSize: 11 }}>Development</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{activeGoals.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            active goal{activeGoals.length === 1 ? '' : 's'}
            {latestEvaluationDate ? ` · last evaluated ${new Date(latestEvaluationDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ' · not yet evaluated'}
          </div>
        </div>
        <div className="card">
          <div className="section-label" style={{ fontSize: 11 }}>Upcoming</div>
          {upcomingSessions.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>Nothing scheduled.</p>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {new Date(upcomingSessions[0].starts_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {upcomingSessions.length} session{upcomingSessions.length === 1 ? '' : 's'} coming up
              </div>
            </>
          )}
        </div>
      </div>

      {activeGoals.length > 0 && (
        <>
          <div className="section-label">Active goals</div>
          <div className="card" style={{ marginBottom: 16 }}>
            {activeGoals.map((g) => (
              <div key={g.id} className="list-row">
                <span className="list-row-title">{g.title}{g.skillName ? ` — ${g.skillName}` : ''}</span>
                <span className="chip">{g.status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-label">Recent activity</div>
      <div className="card">
        {recentActivity.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing recorded yet.</p>}
        {recentActivity.slice(0, 10).map((e, i) => (
          <div key={i} className="list-row" style={{ padding: '6px 0' }}>
            <span style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>
                {new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              {'  '}{e.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
