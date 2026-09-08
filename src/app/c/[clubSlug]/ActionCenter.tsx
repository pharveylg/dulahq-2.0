import Link from 'next/link';

type Session = { id: string; teamId: string; teamSlug: string; teamName: string; startsAt: string; endsAt: string };
type ActionItem = { id: string; labelPrefix: string; startsAt?: string; href: string; urgent?: boolean };
type TeamSnapshot = { teamId: string; teamSlug: string; teamName: string; playerCount: number; attendancePct: number | null; activeGoals: number; goalsNeedingAttention: number };

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * "What do I need to know and do today?" (Coach Module spec §1). Shown to
 * both club_admin (club-wide) and coach/team_manager (their assigned teams
 * only) -- same component, scoped by the team list the caller passes in.
 * Deliberately action-first: the Action Center list comes before the
 * snapshot tiles, per the spec's own "prioritize actions rather than just
 * display statistics."
 */
export default function ActionCenter({
  clubSlug,
  todaySessions,
  upcomingSessions,
  actionItems,
  teamSnapshots,
}: {
  clubSlug: string;
  todaySessions: Session[];
  upcomingSessions: Session[];
  actionItems: ActionItem[];
  teamSnapshots: TeamSnapshot[];
}) {
  return (
    <div>
      <div className="section-label">Action center</div>
      <div className="card" style={{ marginBottom: 20 }}>
        {actionItems.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing needs your attention right now.</p>
        )}
        {actionItems.map((item) => (
          <Link key={item.id} href={item.href} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="list-row-title">{item.labelPrefix}{item.startsAt ? ` — ${dateLabel(item.startsAt)}` : ''}</span>
            <span className="chip" style={item.urgent ? { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' } : undefined}>
              {item.urgent ? 'Needs attention' : 'To do'}
            </span>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div>
          <div className="section-label" style={{ fontSize: 11 }}>Today&apos;s schedule</div>
          <div className="card">
            {todaySessions.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No sessions today.</p>}
            {todaySessions.map((s) => (
              <Link key={s.id} href={`/c/${clubSlug}/teams/${s.teamSlug}/training/${s.id}`} className="list-row" style={{ padding: '6px 0', textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: 13 }}>{timeLabel(s.startsAt)} · {s.teamName}</span>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div className="section-label" style={{ fontSize: 11 }}>Upcoming</div>
          <div className="card">
            {upcomingSessions.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Nothing scheduled.</p>}
            {upcomingSessions.map((s) => (
              <Link key={s.id} href={`/c/${clubSlug}/teams/${s.teamSlug}/training/${s.id}`} className="list-row" style={{ padding: '6px 0', textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: 13 }}>{dateLabel(s.startsAt)} · {timeLabel(s.startsAt)} · {s.teamName}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="section-label">Team snapshot</div>
      <div className="card">
        {teamSnapshots.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No teams assigned yet.</p>}
        {teamSnapshots.map((t) => (
          <Link key={t.teamId} href={`/c/${clubSlug}/teams/${t.teamSlug}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="list-row-main">
              <div className="list-row-title">{t.teamName}</div>
              <div className="list-row-meta">
                {t.playerCount} player{t.playerCount === 1 ? '' : 's'}
                {t.attendancePct !== null ? ` · ${t.attendancePct}% attendance (30d)` : ' · no attendance yet'}
                {t.activeGoals > 0 ? ` · ${t.activeGoals} active goal${t.activeGoals === 1 ? '' : 's'}` : ''}
              </div>
            </div>
            {t.goalsNeedingAttention > 0 && (
              <span className="chip" style={{ color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' }}>
                {t.goalsNeedingAttention} needs attention
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
