'use client';

import { useActionState } from 'react';
import { linkTeam } from './actions';

type ActionState = { error?: string; success?: boolean };
const initialState: ActionState = {};

export default function LinkTeamForm({
  clubId,
  unclaimedTeams,
}: {
  clubId: string;
  unclaimedTeams: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await linkTeam(clubId, formData)) ?? {},
    initialState
  );

  if (unclaimedTeams.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        No unclaimed teams available to link.
      </p>
    );
  }

  return (
    <form action={formAction} className="form-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
      <div className="form-group" style={{ flex: 2, minWidth: 160 }}>
        <select name="teamId" required defaultValue="">
          <option value="" disabled>Choose a team…</option>
          {unclaimedTeams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div className="form-group" style={{ flex: 1, minWidth: 110 }}>
        <input name="slug" placeholder="URL slug, e.g. u12" required pattern="[a-z0-9-]+" title="lowercase letters, numbers, hyphens only" />
      </div>
      <button type="submit" className="btn" disabled={pending}>
        {pending ? 'Linking…' : 'Link team'}
      </button>
      {state?.error && <span className="error-text">{state.error}</span>}
    </form>
  );
}
