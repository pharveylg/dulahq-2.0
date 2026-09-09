'use client';

import { useState, useTransition } from 'react';
import { startViewAs, endViewAs } from './actions';

export type DirectoryEntry = {
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  isPlatformAdmin: boolean;
};

export type ActiveSession = {
  sessionId: string;
  targetUserId: string;
  targetName: string | null;
  reason: string;
  expiresAt: string;
};

type PermissionEntry = { key: string; label: string };
export type AccessReadout = {
  role: string | null;
  is_player: boolean;
  is_guardian: boolean;
  club_wide: boolean;
  teams: { id: string; name: string }[];
  club_permissions: PermissionEntry[];
  team_permissions: PermissionEntry[];
  missing_permissions: PermissionEntry[];
};

function PermissionList({ title, items, tone }: { title: string; items: PermissionEntry[]; tone: 'has' | 'missing' }) {
  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      <div className="section-label" style={{ fontSize: 11 }}>{title} ({items.length})</div>
      {items.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>None.</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
        {items.map((p) => (
          <span
            key={p.key}
            className="chip"
            title={p.key}
            style={tone === 'has'
              ? { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' }
              : { color: 'var(--text-muted)' }}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ViewAsPanel({
  clubId,
  directory,
  activeSession,
  readout,
  canImpersonate,
}: {
  clubId: string;
  directory: DirectoryEntry[];
  activeSession: ActiveSession | null;
  readout: AccessReadout | null;
  canImpersonate: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState('');

  function handleStart(formData: FormData) {
    setError(null);
    const targetUserId = formData.get('targetUserId') as string;
    const reason = ((formData.get('reason') as string) ?? '').trim();
    if (!targetUserId) return setError('Choose someone to view as.');
    if (!reason) return setError('A reason is required — it goes into the audit log.');
    startTransition(async () => {
      const result = await startViewAs(clubId, targetUserId, reason);
      if (result?.error) setError(result.error);
    });
  }

  function handleEnd() {
    if (!activeSession) return;
    setError(null);
    startTransition(async () => {
      const result = await endViewAs(activeSession.sessionId);
      if (result?.error) setError(result.error);
    });
  }

  if (activeSession) {
    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="list-row-title">Viewing as {activeSession.targetName ?? 'this user'}</div>
            <div className="list-row-meta">
              Reason: {activeSession.reason} · expires {new Date(activeSession.expiresAt).toLocaleTimeString()}
            </div>
          </div>
          <button className="btn" style={{ fontSize: 11.5 }} disabled={pending} onClick={handleEnd}>
            {pending ? 'Ending…' : 'End session'}
          </button>
        </div>

        {readout && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, marginBottom: 10 }}>
              Role: <strong>{readout.role ?? 'no staff role'}</strong>
              {readout.club_wide && <span className="chip" style={{ marginLeft: 6 }}>club-wide</span>}
              {readout.is_player && <span className="chip" style={{ marginLeft: 6 }}>player</span>}
              {readout.is_guardian && <span className="chip" style={{ marginLeft: 6 }}>guardian</span>}
            </div>

            <div className="section-label" style={{ fontSize: 11 }}>Assigned teams</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 0 }}>
              {readout.teams.length === 0
                ? readout.club_wide
                  ? 'No specific assignment — club-wide by role.'
                  : 'None. Team-scoped permissions will not apply anywhere.'
                : readout.teams.map((t) => t.name).join(', ')}
            </p>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 12 }}>
              <PermissionList title="Club-wide permissions" items={readout.club_permissions} tone="has" />
              <PermissionList title="Team permissions" items={readout.team_permissions} tone="has" />
            </div>
            <div style={{ marginTop: 16 }}>
              <PermissionList title="Does NOT have" items={readout.missing_permissions} tone="missing" />
            </div>
          </div>
        )}

        {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
      </div>
    );
  }

  if (!canImpersonate) {
    return (
      <div className="card">
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          You can review this club&apos;s audit trail, but starting a view-as session needs the
          &ldquo;View as another user&rdquo; permission.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 0 }}>
        Inspect what another member can and cannot do here, to answer &ldquo;why can&apos;t they see X?&rdquo;.
        This does not sign you in as them and cannot act on their behalf. The session is logged with
        your identity and the reason, and expires after 30 minutes.
      </p>
      <form action={handleStart} className="form-row" style={{ flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
          <select name="targetUserId" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Choose a member…</option>
            {directory.map((d) => (
              <option key={d.userId} value={d.userId} disabled={d.isPlatformAdmin}>
                {d.name ?? d.email} — {d.role}{d.isPlatformAdmin ? ' (platform admin)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 2, minWidth: 240 }}>
          <input name="reason" placeholder="Reason (recorded in the audit log)" required />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending} style={{ fontSize: 12 }}>
          {pending ? 'Starting…' : 'Start view-as'}
        </button>
      </form>
      {error && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
