'use client';

import { useState, useTransition } from 'react';
import { addMembershipPeriod, updateMembershipStatus } from './membership-actions';

type Membership = { id: string; periodStart: string; periodEnd: string | null; status: string };

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  active: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' },
  expired: { color: 'var(--text-muted)' },
  pending: { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' },
  transferred: { color: 'var(--blue)', background: 'var(--blue-soft)', borderColor: 'var(--blue-soft-border)' },
};

const STATUSES = ['pending', 'active', 'expired', 'transferred'];

export default function PlayerMembership({
  clubId,
  teamId,
  playerId,
  memberships,
  canManage,
}: {
  clubId: string;
  teamId: string;
  playerId: string;
  memberships: Membership[];
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addMembershipPeriod(clubId, teamId, playerId, formData);
      if (result?.error) setError(result.error);
      else setShowAdd(false);
    });
  }

  function handleStatusChange(membershipId: string, status: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateMembershipStatus(clubId, teamId, membershipId, status);
      if (result?.error) setError(result.error);
    });
  }

  const sorted = [...memberships].sort((a, b) => b.periodStart.localeCompare(a.periodStart));

  return (
    <div style={{ paddingLeft: 2 }}>
      {sorted.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No membership periods recorded.</p>}
      {sorted.map((m) => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
          <span style={{ fontSize: 13 }}>
            {m.periodStart}
            {m.periodEnd ? ` – ${m.periodEnd}` : ' – ongoing'}
          </span>
          {canManage ? (
            <select
              value={m.status}
              disabled={pending}
              onChange={(e) => handleStatusChange(m.id, e.target.value)}
              style={{ fontSize: 12, padding: '3px 6px', ...STATUS_STYLE[m.status] }}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <span className="chip" style={STATUS_STYLE[m.status]}>{m.status}</span>
          )}
        </div>
      ))}

      {canManage && !showAdd && (
        <button className="btn" style={{ fontSize: 11.5, marginTop: 6 }} onClick={() => setShowAdd(true)}>
          + Add period
        </button>
      )}
      {canManage && showAdd && (
        <form action={handleAdd} className="form-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 130 }}>
            <input name="periodStart" type="date" required />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 130 }}>
            <input name="periodEnd" type="date" placeholder="End (optional)" />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 110 }}>
            <select name="status" defaultValue="active">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending} style={{ fontSize: 12 }}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}
      {error && <p className="error-text" style={{ marginTop: 4 }}>{error}</p>}
    </div>
  );
}
