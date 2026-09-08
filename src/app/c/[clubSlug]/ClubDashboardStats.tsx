'use client';

import Reveal from '@/components/motion/Reveal';
import AnimatedNumber from '@/components/motion/AnimatedNumber';
import { formatMoney } from '@/lib/currency';

type Dashboard = {
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

export default function ClubDashboardStats({
  teamCount,
  staffCount,
  dashboard,
}: {
  teamCount: number;
  staffCount: number;
  dashboard: Dashboard;
}) {
  return (
    <>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20, marginBottom: 20 }}>
        <Tile index={0} value={<AnimatedNumber value={teamCount} />} label="Teams" />
        <Tile index={1} value={<AnimatedNumber value={dashboard.playerCount} />} label="Players" />
        <Tile index={2} value={<AnimatedNumber value={staffCount} />} label="Staff" />
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
  );
}
