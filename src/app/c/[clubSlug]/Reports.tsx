'use client';

import Reveal from '@/components/motion/Reveal';
import AnimatedNumber from '@/components/motion/AnimatedNumber';
import { formatMoney } from '@/lib/currency';

type TeamBreakdown = {
  teamId: string;
  teamName: string;
  playerCount: number;
  attendancePct: number | null;
  evaluationsCount: number;
  activeGoals: number;
  goalsNeedingAttention: number;
};

type ClubWideDashboard = {
  playerCount: number;
  pendingInvites: { guardianName: string; playerName: string }[];
  outstandingFees: { currency: string; total: number; count: number }[];
  playersWithoutEvaluation: number;
  activeGoals: number;
  goalsNeedingAttention: number;
  attendancePct30d: number | null;
};

function Tile({ index, value, label, warn }: { index: number; value: React.ReactNode; label: string; warn?: boolean }) {
  return (
    <Reveal index={index} className="stat-tile">
      <div className="stat-value" style={warn ? { color: 'var(--warn)' } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
    </Reveal>
  );
}

export default function Reports({
  teams,
  financials,
  dashboard,
  teamCount,
  staffCount,
}: {
  teams: TeamBreakdown[];
  financials: { collected: number; outstanding: number; expenses: number; currency: string };
  /** club_admin only -- null for a plain `staff` viewer, who can still see
   *  this tab (canManageFinances) but not the club-wide rollup. */
  dashboard?: ClubWideDashboard | null;
  teamCount?: number;
  staffCount?: number;
}) {
  return (
    <>
      {/* Gap analysis P1-12: this was its own sibling surface
          (ClubDashboardStats) under a "Club-wide" label on the Overview
          tab, next to ActionCenter -- three dashboard-shaped surfaces
          fragmenting one "how's the club doing" question. Folded in here,
          since Reports is already "after-the-fact visibility" and this
          rollup is exactly that; ActionCenter stays separate, since
          "what do I need to do today" is a genuinely different job. */}
      {dashboard && (
        <>
          <div className="section-label">Club-wide</div>
          <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20, marginBottom: 20 }}>
            <Tile index={0} value={<AnimatedNumber value={teamCount ?? 0} />} label="Teams" />
            <Tile index={1} value={<AnimatedNumber value={dashboard.playerCount} />} label="Players" />
            <Tile index={2} value={<AnimatedNumber value={staffCount ?? 0} />} label="Staff" />
            <Tile
              index={3}
              value={dashboard.attendancePct30d !== null ? <AnimatedNumber value={dashboard.attendancePct30d} suffix="%" /> : '—'}
              label="Attendance (30d)"
            />
            <Tile index={4} value={<AnimatedNumber value={dashboard.activeGoals} />} label="Active goals" />
            <Tile
              index={5}
              value={<AnimatedNumber value={dashboard.goalsNeedingAttention} />}
              label="Goals needing attention"
              warn={dashboard.goalsNeedingAttention > 0}
            />
            <Tile
              index={6}
              value={<AnimatedNumber value={dashboard.playersWithoutEvaluation} />}
              label="Never evaluated"
              warn={dashboard.playersWithoutEvaluation > 0}
            />
            <Tile
              index={7}
              value={<AnimatedNumber value={dashboard.pendingInvites.length} />}
              label="Pending guardian invites"
              warn={dashboard.pendingInvites.length > 0}
            />
            {dashboard.outstandingFees.map((f, i) => (
              <Tile
                key={f.currency}
                index={8 + i}
                value={formatMoney(f.total, f.currency)}
                label={`Outstanding (${f.count} charge${f.count === 1 ? '' : 's'})`}
                warn
              />
            ))}
          </div>

          {dashboard.pendingInvites.length > 0 && (
            <details style={{ marginBottom: 20 }}>
              <summary style={{ fontSize: 12.5, color: 'var(--text-muted)', cursor: 'pointer' }}>
                {dashboard.pendingInvites.length} guardian invite{dashboard.pendingInvites.length === 1 ? '' : 's'} awaiting acceptance
              </summary>
              <div className="card" style={{ marginTop: 8 }}>
                {dashboard.pendingInvites.map((inv, i) => (
                  <div key={i} className="list-row" style={{ padding: '6px 0' }}>
                    <span style={{ fontSize: 13 }}>{inv.guardianName} — {inv.playerName}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}

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
          <div className="stat-value">{formatMoney(financials.collected, financials.currency)}</div>
          <div className="stat-label">Collected</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value" style={financials.outstanding > 0 ? { color: 'var(--warn)' } : undefined}>{formatMoney(financials.outstanding, financials.currency)}</div>
          <div className="stat-label">Outstanding</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{formatMoney(financials.expenses, financials.currency)}</div>
          <div className="stat-label">Expenses</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value" style={(financials.collected - financials.expenses) < 0 ? { color: 'var(--warn)' } : undefined}>
            {formatMoney(financials.collected - financials.expenses, financials.currency)}
          </div>
          <div className="stat-label">Net</div>
        </div>
      </div>
    </>
  );
}
