'use client';

import { useState, useTransition } from 'react';
import { startProductTrial } from './actions';

export default function StartTrialForm({
  orgId,
  trialDays,
  caps,
}: {
  orgId: string;
  trialDays: number;
  caps: { club: { clubs: number; teams: number }; tournament: { tournaments: number; entries: number } };
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await startProductTrial(orgId, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5 }}>
        <input type="checkbox" name="products" value="club" style={{ marginTop: 3 }} />
        <span>
          <strong>Club</strong> — up to {caps.club.clubs} club and {caps.club.teams} team.
        </span>
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5 }}>
        <input type="checkbox" name="products" value="tournament" style={{ marginTop: 3 }} />
        <span>
          <strong>Tournament</strong> — up to {caps.tournament.tournaments} tournament and{' '}
          {caps.tournament.entries} pending or accepted entries.
        </span>
      </label>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
        {trialDays} days from when you start, no charge today. Starting a second product
        later shares this same end date. You will not be charged automatically.
      </p>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? 'Starting…' : 'Start free trial'}
      </button>
    </form>
  );
}
