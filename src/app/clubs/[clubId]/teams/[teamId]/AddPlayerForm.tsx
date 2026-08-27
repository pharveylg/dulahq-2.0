'use client';

import { useActionState } from 'react';
import { addPlayer } from './actions';

type ActionState = { error?: string; success?: boolean };
const initialState: ActionState = {};

export default function AddPlayerForm({ clubId, teamId }: { clubId: string; teamId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await addPlayer(clubId, teamId, formData)) ?? {},
    initialState
  );

  return (
    <form action={formAction} className="form-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
      <div className="form-group" style={{ flex: 2, minWidth: 140 }}>
        <input name="name" placeholder="Player name" required />
      </div>
      <div className="form-group" style={{ flex: 1, minWidth: 70 }}>
        <input name="jersey" placeholder="Jersey #" />
      </div>
      <div className="form-group" style={{ flex: 1, minWidth: 90 }}>
        <input name="position" placeholder="Position" />
      </div>
      <div className="form-group" style={{ flex: 1, minWidth: 70 }}>
        <input name="age" placeholder="Age" />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Adding…' : 'Add player'}
      </button>
      {state?.error && <span className="error-text">{state.error}</span>}
    </form>
  );
}
