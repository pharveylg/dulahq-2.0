'use client';

import Reveal from '@/components/motion/Reveal';

type TeamBreakdown = {
  teamId: string;
  teamName: string;
  playerCount: number;
  attendancePct: number | null;
  evaluationsCount: number;
  activeGoals: number;
  goalsNeedingAttention: number;
};

export default function Reports({
  teams,
  financials,
}: {
  teams: TeamBreakdown[];
  financials: { collected: number; outstanding: number; expenses: number; currency: string };
}) {
  return (
    <>
      <div className="section-label">Attendance &amp; development by team (30 days)</div>
      <div className="card" style={{ marginBottom: 20, overflowX: 'auto' }}>
        {teams.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No teams yet.</p>}
        {teams.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 8px 8px 0', fontFamily: 'var(--font-heading)', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Team</th>
                <th style={{ padding: '8px', fontFamily: 'var(--font-heading)', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Players</th>
                <th style={{ padding: '8px', fontFamily: 'var(--font-heading)', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Attendance</th>
                <th style={{ padding: '8px', fontFamily: 'var(--font-heading)', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Evaluations</th>
                <th style={{ padding: '8px', fontFamily: 'var(--font-heading)', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Active goals</th>
                <th style={{ padding: '8px', fontFamily: 'var(--font-heading)', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Needs attention</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t, i) => (
                <Reveal key={t.teamId} index={i}>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 8px 10px 0', fontWeight: 600 }}>{t.teamName}</td>
                    <td style={{ padding: 8 }}>{t.playerCount}</td>
                    <td style={{ padding: 8 }}>{t.attendancePct !== null ? `${t.attendancePct}%` : '—'}</td>
                    <td style={{ padding: 8 }}>{t.evaluationsCount}</td>
                    <td style={{ padding: 8 }}>{t.activeGoals}</td>
                    <td style={{ padding: 8, color: t.goalsNeedingAttention > 0 ? 'var(--warn)' : undefined }}>{t.goalsNeedingAttention}</td>
                  </tr>
                </Reveal>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-label">Financial summary</div>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20 }}>
        <div className="stat-tile">
          <div className="stat-value">{financials.currency} {financials.collected.toFixed(2)}</div>
          <div className="stat-label">Collected</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value" style={financials.outstanding > 0 ? { color: 'var(--warn)' } : undefined}>{financials.currency} {financials.outstanding.toFixed(2)}</div>
          <div className="stat-label">Outstanding</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{financials.currency} {financials.expenses.toFixed(2)}</div>
          <div className="stat-label">Expenses</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value" style={(financials.collected - financials.expenses) < 0 ? { color: 'var(--warn)' } : undefined}>
            {financials.currency} {(financials.collected - financials.expenses).toFixed(2)}
          </div>
          <div className="stat-label">Net</div>
        </div>
      </div>
    </>
  );
}
