'use client';

import { useState, useTransition } from 'react';
import { submitRoster } from '../actions';

type Candidate = {
  id: string;
  name: string;
  jersey: string | null;
  position: string | null;
  needsConsent: boolean;
  approvalStatus: string | null;
  declineReason: string | null;
};
type FinalRosterPlayer = { id: string; name: string; jersey: string | null; position: string | null };

const STATUS_LABEL: Record<string, { label: string; style: React.CSSProperties }> = {
  awaiting: { label: 'Awaiting guardian', style: { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' } },
  approved: { label: 'Guardian approved', style: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' } },
  declined: { label: 'Declined', style: { color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'var(--danger-soft-border)' } },
  expired: { label: 'Expired', style: { color: 'var(--text-muted)' } },
  cancelled: { label: 'Cancelled', style: { color: 'var(--text-muted)' } },
};

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Coach Module spec §9-15, collapsed into one "Submit Roster" action -- see
 * actions.ts's submitRoster() for why (no draft-roster table to persist a
 * multi-step selection across visits). A candidate whose guardian approval
 * is still 'awaiting' can't be selected; one that's 'approved' defaults to
 * selected since it's immediately portable.
 */
export default function RosterBuilder({
  entryId,
  orgId,
  teamName,
  tournamentName,
  categoryName,
  entryAccepted,
  canFinalize,
  candidates,
  finalizedRoster,
}: {
  entryId: string;
  orgId: string;
  clubSlug: string;
  teamSlug: string;
  teamName: string;
  tournamentName: string;
  categoryName: string | null;
  entryAccepted: boolean;
  canFinalize: boolean;
  candidates: Candidate[];
  finalizedRoster: FinalRosterPlayer[];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(candidates.filter((c) => c.approvalStatus === 'approved').map((c) => c.id))
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await submitRoster(entryId, orgId, [...selected]);
      if (result?.error) setError(result.error);
      else {
        setMessage(result?.message ?? 'Roster updated.');
        setSelected(new Set());
      }
    });
  }

  function exportTxt() {
    const lines = [
      'DULA HQ — TOURNAMENT ROSTER',
      '',
      `Tournament: ${tournamentName}`,
      `Category: ${categoryName ?? '—'}`,
      `Team: ${teamName}`,
      `Generated: ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`,
      '',
      '#   Jersey  Position   Name',
      ...finalizedRoster.map((p, i) => `${String(i + 1).padEnd(4)}${(p.jersey ?? '—').padEnd(8)}${(p.position ?? '—').padEnd(11)}${p.name}`),
    ];
    downloadText(`${tournamentName.replace(/\s+/g, '-')}-${teamName.replace(/\s+/g, '-')}-roster.txt`, lines.join('\n'));
  }

  return (
    <div>
      {finalizedRoster.length > 0 && (
        <>
          <div className="section-label">Final roster ({finalizedRoster.length})</div>
          <div className="card" style={{ marginBottom: 20 }}>
            {finalizedRoster.map((p) => (
              <div key={p.id} className="list-row">
                <span className="list-row-title">{p.name}</span>
                <span className="list-row-meta">{[p.jersey && `#${p.jersey}`, p.position].filter(Boolean).join(' · ')}</span>
              </div>
            ))}
          </div>
          <button className="btn" style={{ marginBottom: 24 }} onClick={exportTxt}>Export roster (TXT)</button>
        </>
      )}

      {candidates.length === 0 && finalizedRoster.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No players on this team&apos;s roster yet.</p>
      )}

      {candidates.length > 0 && (
        <>
          <div className="section-label">Build roster</div>
          <div className="card" style={{ marginBottom: canFinalize && entryAccepted ? 12 : 20 }}>
            {candidates.map((c) => {
              const disabled = !canFinalize || !entryAccepted || c.approvalStatus === 'awaiting' || c.approvalStatus === 'declined';
              const status = c.approvalStatus ? STATUS_LABEL[c.approvalStatus] : null;
              return (
                <div key={c.id} className="list-row">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: disabled ? 'default' : 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      disabled={disabled || pending}
                      onChange={() => toggle(c.id)}
                    />
                    {c.name}
                    <span style={{ color: 'var(--text-muted)' }}>
                      {[c.jersey && `#${c.jersey}`, c.position].filter(Boolean).join(' · ')}
                    </span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {!c.needsConsent && <span className="chip" style={{ fontSize: 10 }}>Adult</span>}
                    {status && (
                      <span className="chip" style={{ fontSize: 10, ...status.style }} title={c.declineReason ?? undefined}>
                        {status.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {canFinalize && entryAccepted && (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={pending || selected.size === 0}>
              {pending ? 'Submitting…' : `Submit roster (${selected.size} selected)`}
            </button>
          )}
          {!canFinalize && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Only a club admin or the coach assigned to this team can build this tournament&apos;s roster.
            </p>
          )}

          {message && <p style={{ fontSize: 13, color: 'var(--accent)', marginTop: 10 }}>{message}</p>}
          {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
        </>
      )}
    </div>
  );
}
