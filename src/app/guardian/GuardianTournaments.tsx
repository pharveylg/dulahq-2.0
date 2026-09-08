'use client';

import { useState, useTransition } from 'react';
import { decideAcknowledgement } from './tournament-actions';

type Ack = {
  id: string;
  playerName: string;
  tournamentName: string;
  categoryName: string | null;
  venue: string | null;
  eventDate: string | null;
  status: 'draft' | 'awaiting' | 'approved' | 'declined' | 'expired' | 'cancelled';
  declineReason: string | null;
  decidedAt: string | null;
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  approved: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' },
  declined: { color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'var(--danger-soft-border)' },
  expired: { color: 'var(--text-muted)' },
  cancelled: { color: 'var(--text-muted)' },
};

function AckCard({ ack }: { ack: Ack }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDecline, setShowDecline] = useState(false);
  const [reason, setReason] = useState('');

  function decide(decision: 'approved' | 'declined') {
    setError(null);
    startTransition(async () => {
      const result = await decideAcknowledgement(ack.id, decision, decision === 'declined' ? reason : undefined);
      if (result?.error) setError(result.error);
      else setShowDecline(false);
    });
  }

  const needsDecision = ack.status === 'awaiting';

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{ack.tournamentName}{ack.categoryName ? ` — ${ack.categoryName}` : ''}</div>
          <div className="list-row-meta">
            {ack.playerName}
            {ack.eventDate ? ` · ${new Date(ack.eventDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
            {ack.venue ? ` · ${ack.venue}` : ''}
          </div>
        </div>
        {!needsDecision && (
          <span className="chip" style={STATUS_STYLE[ack.status]}>
            {ack.status === 'approved' ? 'Confirmed' : ack.status}
          </span>
        )}
      </div>

      {ack.status === 'declined' && ack.declineReason && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>Reason: {ack.declineReason}</p>
      )}

      {needsDecision && !showDecline && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary" disabled={pending} onClick={() => decide('approved')}>
            {pending ? 'Saving…' : 'Confirm participation'}
          </button>
          <button className="btn" disabled={pending} onClick={() => setShowDecline(true)}>Decline</button>
        </div>
      )}

      {needsDecision && showDecline && (
        <div style={{ marginTop: 8 }}>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <textarea
              placeholder="Let the coach know why (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" disabled={pending} onClick={() => decide('declined')}>
              {pending ? 'Saving…' : 'Confirm decline'}
            </button>
            <button className="btn" disabled={pending} onClick={() => setShowDecline(false)}>Cancel</button>
          </div>
        </div>
      )}

      {error && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}

/**
 * Parent/Guardian spec §8-13: tournaments involving an authorized child,
 * and the acknowledgement action itself. One flat list rather than grouped
 * by child -- a guardian with several kids in the same tournament shouldn't
 * have to hunt across tabs for a pending confirmation.
 */
export default function GuardianTournaments({ acknowledgements }: { acknowledgements: Ack[] }) {
  const pending = acknowledgements.filter((a) => a.status === 'awaiting');
  const decided = acknowledgements.filter((a) => a.status !== 'awaiting');

  return (
    <div>
      {acknowledgements.length === 0 && (
        <div className="card empty-state">
          <p>No tournament participation to review yet.</p>
        </div>
      )}

      {pending.length > 0 && (
        <>
          <div className="section-label">Needs your response ({pending.length})</div>
          {pending.map((a) => <AckCard key={a.id} ack={a} />)}
        </>
      )}

      {decided.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: pending.length > 0 ? 20 : 0 }}>Past</div>
          {decided.map((a) => <AckCard key={a.id} ack={a} />)}
        </>
      )}
    </div>
  );
}
