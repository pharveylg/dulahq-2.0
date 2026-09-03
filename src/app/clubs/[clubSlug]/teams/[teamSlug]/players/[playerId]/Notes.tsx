'use client';

import { useState, useActionState } from 'react';
import { addNote } from './actions';

type Note = { id: string; note: string; visibility: string; created_at: string };
type ActionState = { error?: string; success?: boolean };
const initialState: ActionState = {};

const VISIBILITY_OPTIONS = [
  { value: 'coach_only', label: 'Coach only' },
  { value: 'staff', label: 'Club staff' },
  { value: 'player', label: 'Player' },
  { value: 'parent', label: 'Parent' },
  { value: 'player_and_parent', label: 'Player + parent' },
];

export default function Notes({
  playerId, teamId, clubId, notes, canManage,
}: {
  playerId: string; teamId: string; clubId: string; notes: Note[]; canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await addNote(playerId, teamId, clubId, formData)) ?? {},
    initialState
  );

  return (
    <>
      <div className="card">
        {notes.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No notes yet.</p>}
        {notes.map((n) => (
          <div key={n.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
            <p style={{ fontSize: 13, margin: 0 }}>&ldquo;{n.note}&rdquo;</p>
            <div className="list-row-meta">
              {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              {' · visible to: '}{VISIBILITY_OPTIONS.find((v) => v.value === n.visibility)?.label}
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <form action={formAction} className="form-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 3, minWidth: 220 }}>
            <input name="note" placeholder="Add a note or feedback…" required />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
            <select name="visibility" defaultValue="coach_only">
              {VISIBILITY_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Add'}</button>
          {state?.error && <span className="error-text">{state.error}</span>}
        </form>
      )}
    </>
  );
}
