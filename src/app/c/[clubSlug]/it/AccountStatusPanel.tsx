'use client';

import { useState, useTransition } from 'react';
import { setStaffAccountStatus } from './actions';

export type AccountEntry = {
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
  isPlatformAdmin: boolean;
};

/**
 * P1-11 (gap analysis): the reversible, IT-owned counterpart to the club
 * manager's "Remove" (Staff tab, phase6z) -- suspend locks someone out
 * without deciding they've left; reactivate reverses it. Platform admins
 * are excluded from the list entirely, same as ViewAsPanel's picker --
 * neither view-as nor account-status actions apply to them.
 */
export default function AccountStatusPanel({
  clubId,
  accounts,
}: {
  clubId: string;
  accounts: AccountEntry[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  function toggle(userId: string, nextStatus: 'active' | 'suspended') {
    setError(null);
    setBusyUserId(userId);
    startTransition(async () => {
      const result = await setStaffAccountStatus(clubId, userId, nextStatus);
      if (result?.error) setError(result.error);
      setBusyUserId(null);
    });
  }

  const visible = accounts.filter((a) => !a.isPlatformAdmin);

  return (
    <div className="card">
      {visible.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No other accounts to manage.</p>
      )}
      {visible.map((a) => {
        const suspended = a.status === 'suspended';
        return (
          <div key={a.userId} className="list-row">
            <div className="list-row-main">
              <div className="list-row-title">{a.name ?? a.email ?? 'Unknown'}</div>
              <div className="list-row-meta">{a.email} · {a.role}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                className="chip"
                style={suspended ? { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' } : undefined}
              >
                {suspended ? 'suspended' : 'active'}
              </span>
              <button
                className="btn"
                style={{ fontSize: 11.5 }}
                disabled={pending && busyUserId === a.userId}
                onClick={() => toggle(a.userId, suspended ? 'active' : 'suspended')}
              >
                {pending && busyUserId === a.userId ? 'Working…' : suspended ? 'Reactivate' : 'Suspend'}
              </button>
            </div>
          </div>
        );
      })}
      {error && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
