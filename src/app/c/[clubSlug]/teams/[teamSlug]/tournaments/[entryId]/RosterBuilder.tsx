'use client';

import { useState, useTransition } from 'react';
import {
  addRosterCandidates,
  removeRosterCandidate,
  requestAcknowledgements,
  finalizeRoster,
  recordRosterExport,
} from '../actions';
import {
  derivePlayerState,
  deriveRosterState,
  PLAYER_STATE_LABEL,
  PLAYER_STATE_TONE,
  ROSTER_STATE_LABEL,
  ROSTER_STATE_TONE,
  toneStyle,
} from '@/lib/roster-state';

type PlayerRow = {
  id: string;
  name: string;
  jersey: string | null;
  position: string | null;
  needsConsent: boolean;
  hasGuardian: boolean;
  isCandidate: boolean;
  isFinalized: boolean;
  approvalStatus: string | null;
  declineReason: string | null;
};
type FinalRosterPlayer = { id: string; name: string; jersey: string | null; position: string | null };

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
 * Coach Module spec §15's workflow, made visible rather than enforced
 * (CLAUDE.md §0f). Phase 3 had one "Submit Roster" button doing everything
 * off an in-browser selection; the three stages below are the same two
 * underlying operations, split so each is observable and so a proposal
 * persists for someone else to pick up. Permissions are unchanged -- both
 * the coach and the team manager hold all three.
 */
export default function RosterBuilder({
  entryId,
  orgId,
  teamName,
  tournamentName,
  categoryName,
  entryAccepted,
  canFill,
  canRequest,
  canFinalize,
  players,
  finalizedRoster,
}: {
  entryId: string;
  orgId: string;
  teamName: string;
  tournamentName: string;
  categoryName: string | null;
  entryAccepted: boolean;
  canFill: boolean;
  canRequest: boolean;
  canFinalize: boolean;
  players: PlayerRow[];
  finalizedRoster: FinalRosterPlayer[];
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const withState = players.map((p) => ({ ...p, state: derivePlayerState(p) }));
  const rosterState = deriveRosterState(withState.map((p) => p.state));
  const proposed = withState.filter((p) => p.isCandidate || p.isFinalized);
  const available = withState.filter((p) => !p.isCandidate && !p.isFinalized);

  function run(fn: () => Promise<{ error?: string; message?: string } | undefined>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
      else if (result?.message) setMessage(result.message);
    });
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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
    void recordRosterExport(entryId, orgId, 'txt', finalizedRoster.length);
  }

  const awaitingCount = withState.filter((p) => p.state === 'awaiting_guardian').length;
  const unaskedMinors = withState.filter((p) => p.isCandidate && p.needsConsent && p.state === 'proposed').length;
  const portable = withState.filter(
    (p) => p.isCandidate && !p.isFinalized && (p.state === 'proposed' ? !p.needsConsent : p.state === 'guardian_confirmed')
  ).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <span className="chip" style={{ ...toneStyle(ROSTER_STATE_TONE[rosterState]), fontSize: 11 }}>
          {ROSTER_STATE_LABEL[rosterState]}
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          {proposed.length} proposed · {finalizedRoster.length} finalized
          {awaitingCount > 0 ? ` · ${awaitingCount} awaiting a guardian` : ''}
        </span>
      </div>

      {proposed.length > 0 && (
        <>
          <div className="section-label">Proposed roster ({proposed.length})</div>
          <div className="card" style={{ marginBottom: 16 }}>
            {proposed.map((p) => (
              <div key={p.id} className="list-row">
                <span style={{ fontSize: 13 }}>
                  {p.name}
                  <span style={{ color: 'var(--text-muted)' }}>
                    {' '}{[p.jersey && `#${p.jersey}`, p.position].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {!p.needsConsent && <span className="chip" style={{ fontSize: 10 }}>Adult</span>}
                  <span
                    className="chip"
                    style={{ fontSize: 10, ...toneStyle(PLAYER_STATE_TONE[p.state]) }}
                    title={p.declineReason ?? undefined}
                  >
                    {PLAYER_STATE_LABEL[p.state]}
                  </span>
                  {canFill && !p.isFinalized && (
                    <button
                      className="btn"
                      style={{ fontSize: 10.5, color: 'var(--text-muted)' }}
                      disabled={pending}
                      onClick={() => run(() => removeRosterCandidate(entryId, p.id))}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {entryAccepted && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {canRequest && (
                <button
                  className="btn"
                  disabled={pending || unaskedMinors === 0}
                  onClick={() => run(() => requestAcknowledgements(entryId, orgId))}
                  title={unaskedMinors === 0 ? 'Every proposed minor has already been asked' : undefined}
                >
                  {pending ? 'Working…' : `Ask guardians (${unaskedMinors})`}
                </button>
              )}
              {canFinalize && (
                <button
                  className="btn btn-primary"
                  disabled={pending || portable === 0}
                  onClick={() => run(() => finalizeRoster(entryId, orgId))}
                  title={portable === 0 ? 'Nobody is confirmed and portable yet' : undefined}
                >
                  {pending ? 'Working…' : `Finalize (${portable})`}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {finalizedRoster.length > 0 && (
        <button className="btn" style={{ marginBottom: 24 }} onClick={exportTxt}>
          Export roster (TXT)
        </button>
      )}

      {players.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No players on this team&apos;s roster yet.</p>
      )}

      {canFill && entryAccepted && available.length > 0 && (
        <>
          <div className="section-label">Add players ({available.length} available)</div>
          <div className="card" style={{ marginBottom: 12 }}>
            {available.map((p) => (
              <div key={p.id} className="list-row">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={picked.has(p.id)} disabled={pending} onChange={() => togglePick(p.id)} />
                  {p.name}
                  <span style={{ color: 'var(--text-muted)' }}>
                    {[p.jersey && `#${p.jersey}`, p.position].filter(Boolean).join(' · ')}
                  </span>
                </label>
                {!p.needsConsent
                  ? <span className="chip" style={{ fontSize: 10 }}>Adult</span>
                  : !p.hasGuardian
                    ? <span className="chip" style={{ fontSize: 10, ...toneStyle('bad') }}>No guardian on file</span>
                    : <span className="chip" style={{ fontSize: 10 }}>Needs guardian consent</span>}
              </div>
            ))}
          </div>
          <button
            className="btn"
            disabled={pending || picked.size === 0}
            onClick={() =>
              run(async () => {
                const result = await addRosterCandidates(entryId, orgId, [...picked]);
                if (!result?.error) setPicked(new Set());
                return result;
              })
            }
          >
            {pending ? 'Adding…' : `Propose ${picked.size} player${picked.size === 1 ? '' : 's'}`}
          </button>
        </>
      )}

      {!canFill && !canFinalize && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          You can see this roster&apos;s progress but not change it.
        </p>
      )}

      {message && <p style={{ fontSize: 13, color: 'var(--accent)', marginTop: 10 }}>{message}</p>}
      {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
    </div>
  );
}
