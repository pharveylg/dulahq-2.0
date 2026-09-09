'use client';

import { useState, useTransition } from 'react';
import {
  addRosterCandidates,
  removeRosterCandidate,
  requestAcknowledgements,
  finalizeRoster,
  recordRosterExport,
  withdrawFromRoster,
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
  wasWithdrawn: boolean;
  approvalStatus: string | null;
  declineReason: string | null;
};
type FinalRosterPlayer = {
  id: string;
  playerId: string | null;
  name: string;
  jersey: string | null;
  position: string | null;
  addedInRevision: number;
};
type WithdrawnPlayer = {
  id: string;
  name: string;
  reason: string | null;
  addedInRevision: number;
  withdrawnInRevision: number | null;
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
  withdrawnRoster,
  rosterRevision,
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
  withdrawnRoster: WithdrawnPlayer[];
  rosterRevision: number;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Withdrawal is irreversible for that row and has to say why, so it opens an
  // inline reason field rather than firing on the first click.
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const withState = players.map((p) => ({ ...p, state: derivePlayerState(p) }));
  const rosterState = deriveRosterState(withState.map((p) => p.state));
  const proposed = withState.filter((p) => p.isCandidate || p.isFinalized);
  const available = withState.filter((p) => !p.isCandidate && !p.isFinalized);

  // Withdrawal addresses a tournament_roster row, not a player, so the
  // proposed list needs the id of the row a finalized player actually holds.
  const rosterIdByPlayer = new Map(
    finalizedRoster.filter((r) => r.playerId).map((r) => [r.playerId as string, r.id])
  );

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
      // Which revision this sheet is stops mattering only if rosters can't
      // change after finalization, and since phase6w they can.
      `Roster revision: ${rosterRevision}`,
      `Generated: ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`,
      '',
      '#   Jersey  Position   Name',
      ...finalizedRoster.map((p, i) => `${String(i + 1).padEnd(4)}${(p.jersey ?? '—').padEnd(8)}${(p.position ?? '—').padEnd(11)}${p.name}`),
    ];
    downloadText(`${tournamentName.replace(/\s+/g, '-')}-${teamName.replace(/\s+/g, '-')}-roster.txt`, lines.join('\n'));
    void recordRosterExport(entryId, orgId, 'txt', finalizedRoster.length, rosterRevision);
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
          {rosterRevision > 0 ? ` · revision ${rosterRevision}` : ''}
        </span>
      </div>

      {proposed.length > 0 && (
        <>
          <div className="section-label">Proposed roster ({proposed.length})</div>
          <div className="card" style={{ marginBottom: 16 }}>
            {proposed.map((p) => {
              const rosterId = rosterIdByPlayer.get(p.id);
              return (
                <div key={p.id}>
                  <div className="list-row">
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
                      {canFinalize && p.isFinalized && rosterId && withdrawing !== rosterId && (
                        <button
                          className="btn"
                          style={{ fontSize: 10.5, color: 'var(--text-muted)' }}
                          disabled={pending}
                          onClick={() => { setWithdrawing(rosterId); setReason(''); }}
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>

                  {withdrawing === rosterId && (
                    <div
                      className="list-row"
                      style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
                    >
                      <input
                        className="input"
                        style={{ flex: '1 1 220px', fontSize: 12.5 }}
                        placeholder={`Why is ${p.name} being withdrawn?`}
                        value={reason}
                        disabled={pending}
                        autoFocus
                        onChange={(e) => setReason(e.target.value)}
                      />
                      <button
                        className="btn"
                        disabled={pending || reason.trim() === ''}
                        style={{ fontSize: 11.5 }}
                        onClick={() =>
                          run(async () => {
                            const result = await withdrawFromRoster(rosterId, reason);
                            if (!result?.error) { setWithdrawing(null); setReason(''); }
                            return result;
                          })
                        }
                      >
                        {pending ? 'Withdrawing…' : 'Confirm withdrawal'}
                      </button>
                      <button
                        className="btn"
                        style={{ fontSize: 11.5, color: 'var(--text-muted)' }}
                        disabled={pending}
                        onClick={() => { setWithdrawing(null); setReason(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
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

      {/* Withdrawn rows are kept, never deleted, so the roster as submitted at
          an earlier revision stays reconstructible -- and so the reason a
          player came off it survives the person who typed it. */}
      {withdrawnRoster.length > 0 && (
        <>
          <div className="section-label">Withdrawn ({withdrawnRoster.length})</div>
          <div className="card" style={{ marginBottom: 24 }}>
            {withdrawnRoster.map((r) => (
              <div key={r.id} className="list-row">
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  <span style={{ textDecoration: 'line-through' }}>{r.name}</span>
                  {r.reason ? ` — ${r.reason}` : ''}
                </span>
                <span className="chip" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  on in r{r.addedInRevision} · off in r{r.withdrawnInRevision ?? '?'}
                </span>
              </div>
            ))}
          </div>
        </>
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
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Someone withdrawn from an earlier revision is back on this
                      list, and looks identical to a player never picked unless
                      it is said out loud. */}
                  {p.wasWithdrawn && (
                    <span className="chip" style={{ fontSize: 10, ...toneStyle('warn') }}>
                      {PLAYER_STATE_LABEL.withdrawn} earlier
                    </span>
                  )}
                  {!p.needsConsent
                    ? <span className="chip" style={{ fontSize: 10 }}>Adult</span>
                    : !p.hasGuardian
                      ? <span className="chip" style={{ fontSize: 10, ...toneStyle('bad') }}>No guardian on file</span>
                      : <span className="chip" style={{ fontSize: 10 }}>Needs guardian consent</span>}
                </span>
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
