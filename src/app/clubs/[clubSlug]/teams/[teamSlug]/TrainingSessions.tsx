'use client';

import { useState, useTransition } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { createSession, updateSessionStatus } from './training-actions';

type Session = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  notes: string | null;
  theme: string | null;
  attendanceTaken: number;
};

type ActionState = { error?: string; success?: boolean };
const initialState: ActionState = {};

const SESSION_THEMES = [
  'Ball Mastery', 'Passing', 'Receiving', 'Dribbling', 'Finishing', 'Crossing',
  'Defending', '1v1', 'Possession', 'Transition', 'Pressing', 'Build-up',
  'Attacking', 'Defensive Shape', 'Set Pieces', 'Goalkeeping', 'Speed',
  'Agility', 'Conditioning', 'Match Preparation',
];

function formatSession(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateStr = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const endTimeStr = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} · ${timeStr}–${endTimeStr}`;
}

function SessionRow({ clubId, teamId, clubSlug, teamSlug, session, canManage }: { clubId: string; teamId: string; clubSlug: string; teamSlug: string; session: Session; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setStatus(status: 'scheduled' | 'cancelled' | 'completed') {
    setError(null);
    startTransition(async () => {
      const result = await updateSessionStatus(clubId, teamId, session.id, status);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="list-row-main">
          <Link href={`/clubs/${clubSlug}/teams/${teamSlug}/training/${session.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="list-row-title">{formatSession(session.starts_at, session.ends_at)}{session.theme ? ` — ${session.theme}` : ''}</div>
          </Link>
          <div className="list-row-meta">
            {session.attendanceTaken} recorded{session.notes ? ` · ${session.notes}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="chip"
            style={
              session.status === 'completed'
                ? { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' }
                : session.status === 'cancelled'
                  ? { color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'var(--danger-soft-border)' }
                  : undefined
            }
          >
            {session.status}
          </span>
          {canManage && session.status === 'scheduled' && (
            <>
              <button className="btn" style={{ fontSize: 11.5 }} onClick={() => setStatus('completed')} disabled={pending}>
                Mark done
              </button>
              <button className="btn" style={{ fontSize: 11.5 }} onClick={() => setStatus('cancelled')} disabled={pending}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="error-text" style={{ marginTop: 0 }}>{error}</p>}
    </div>
  );
}

export default function TrainingSessions({
  clubId,
  teamId,
  clubSlug,
  teamSlug,
  sessions,
  canManage,
}: {
  clubId: string;
  teamId: string;
  clubSlug: string;
  teamSlug: string;
  sessions: Session[];
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await createSession(clubId, teamId, formData)) ?? {},
    initialState
  );

  return (
    <div className="card" style={{ marginTop: 12 }}>
      {sessions.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No training sessions scheduled yet.</p>
      )}
      {sessions.map((s) => (
        <SessionRow key={s.id} clubId={clubId} teamId={teamId} clubSlug={clubSlug} teamSlug={teamSlug} session={s} canManage={canManage} />
      ))}

      {canManage && (
        <form action={formAction} className="form-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 2, minWidth: 190 }}>
            <input name="startsAt" type="datetime-local" required />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 110 }}>
            <input name="durationMinutes" type="number" min={15} step={15} defaultValue={60} placeholder="Minutes" />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
            <select name="theme" defaultValue="">
              <option value="">Theme (optional)</option>
              {SESSION_THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 2, minWidth: 150 }}>
            <input name="objective" placeholder="Objective (optional)" />
          </div>
          <div className="form-group" style={{ flex: 2, minWidth: 150 }}>
            <input name="notes" placeholder="Notes (optional)" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Scheduling…' : 'Schedule session'}
          </button>
          {state?.error && <span className="error-text">{state.error}</span>}
        </form>
      )}
    </div>
  );
}
