'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createTrip } from './trips-actions';

type Trip = { id: string; name: string; purpose: string; starts_at: string | null; ends_at: string | null };

type ActionState = { error?: string };
const initialState: ActionState = {};

const PURPOSES = ['training', 'tournament', 'camp', 'match', 'other'];

export default function Trips({ clubId, clubSlug, trips, canManage }: { clubId: string; clubSlug: string; trips: Trip[]; canManage: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await createTrip(clubId, formData)) ?? {},
    initialState
  );

  return (
    <div className="card">
      {trips.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No trips yet.</p>}
      {trips.map((t) => (
        <Link key={t.id} href={`/clubs/${clubSlug}/trips/${t.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="list-row-main">
            <div className="list-row-title">{t.name}</div>
            <div className="list-row-meta">
              {t.purpose}
              {t.starts_at ? ` · ${new Date(t.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
            </div>
          </div>
          <span className="chip">View →</span>
        </Link>
      ))}

      {canManage && (
        <form action={formAction} className="form-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 2, minWidth: 140 }}>
            <input name="name" placeholder="Trip name" required />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 110 }}>
            <select name="purpose" defaultValue="tournament">
              {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
            <input name="startsAt" type="date" />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
            <input name="endsAt" type="date" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Scheduling…' : 'Schedule trip'}
          </button>
          {state?.error && <span className="error-text">{state.error}</span>}
        </form>
      )}
    </div>
  );
}
