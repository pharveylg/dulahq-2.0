'use client';

import { useActionState, useEffect, useRef } from 'react';
import { createTeam } from './actions';

type ActionState = { error?: string; success?: boolean };
const initialState: ActionState = {};

export default function CreateTeamForm({ clubId }: { clubId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await createTeam(clubId, formData)) ?? {},
    initialState
  );

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="form-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
      <div className="form-group" style={{ flex: 2, minWidth: 160 }}>
        <input name="name" placeholder="New team name, e.g. U12 Boys" required />
      </div>
      <div className="form-group" style={{ flex: 1, minWidth: 130 }}>
        <select name="squadType" defaultValue="grassroots" aria-label="Squad type">
          <option value="grassroots">Grassroots (youth)</option>
          <option value="adult">Adult</option>
        </select>
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Creating…' : 'Create team'}
      </button>
      {state?.error && <span className="error-text">{state.error}</span>}
    </form>
  );
}
