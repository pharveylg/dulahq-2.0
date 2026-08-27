'use client';

import { useActionState, useEffect, useState } from 'react';
import { updateClubName } from './actions';

type ActionState = { error?: string; success?: boolean };
const initialState: ActionState = {};

export default function EditNameForm({ clubId, initialName }: { clubId: string; initialName: string }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await updateClubName(clubId, formData)) ?? {},
    initialState
  );

  // Close the edit form once a save succeeds -- useActionState's
  // dispatch function doesn't return the result directly, so react to
  // the resulting state instead of trying to await the form action.
  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state]);

  if (!editing) {
    return (
      <button className="btn" onClick={() => setEditing(true)} style={{ fontSize: 12.5 }}>
        Rename
      </button>
    );
  }

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input name="name" defaultValue={initialName} required style={{ width: 200 }} />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button type="button" className="btn" onClick={() => setEditing(false)}>
        Cancel
      </button>
      {state?.error && <span className="error-text">{state.error}</span>}
    </form>
  );
}
