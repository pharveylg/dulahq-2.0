'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { transferPlayerToTeam } from '@/app/c/[clubSlug]/teams/[teamSlug]/movement-actions';

export type TeamStint = {
  id: string;
  teamId: string;
  teamName: string;
  jersey: string | null;
  position: string | null;
  fromDate: string;
  toDate: string | null;
};

export default function TeamHistory({
  clubSlug,
  playerId,
  stints,
  otherTeams,
  canManage,
}: {
  clubSlug: string | null;
  playerId: string;
  stints: TeamStint[];
  otherTeams: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showMove, setShowMove] = useState(false);

  function handleMove(formData: FormData) {
    setError(null);
    const newTeamId = formData.get('teamId') as string;
    if (!newTeamId) {
      setError('Choose a team.');
      return;
    }
    startTransition(async () => {
      const result = await transferPlayerToTeam(playerId, newTeamId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setShowMove(false);
      // The current page is scoped to the OLD team and 404s once the
      // player has actually moved off it -- follow the player to their
      // new team's page rather than leaving this view stranded.
      if (clubSlug && result.newTeamSlug) {
        router.push(`/c/${clubSlug}/teams/${result.newTeamSlug}/players/${playerId}`);
      } else {
        router.refresh();
      }
    });
  }

  const sorted = [...stints].sort((a, b) => b.fromDate.localeCompare(a.fromDate));

  return (
    <div style={{ paddingLeft: 2, marginBottom: 20 }}>
      <div className="section-label" style={{ fontSize: 11 }}>Team History</div>

      {sorted.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No team history recorded.</p>}
      {sorted.map((s) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
          <span style={{ fontSize: 13 }}>
            {s.teamName}
            {(s.jersey || s.position) && (
              <span style={{ color: 'var(--text-muted)' }}> · {[s.jersey && `#${s.jersey}`, s.position].filter(Boolean).join(' · ')}</span>
            )}
          </span>
          <span className="chip" style={s.toDate ? undefined : { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' }}>
            {s.fromDate}{s.toDate ? ` – ${s.toDate}` : ' – present'}
          </span>
        </div>
      ))}

      {canManage && otherTeams.length > 0 && !showMove && (
        <button className="btn" style={{ fontSize: 11.5, marginTop: 8 }} onClick={() => setShowMove(true)}>
          Move to another team
        </button>
      )}
      {canManage && showMove && (
        <form action={handleMove} className="form-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
            <select name="teamId" defaultValue="">
              <option value="" disabled>Choose a team…</option>
              {otherTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending} style={{ fontSize: 12 }}>
            {pending ? 'Moving…' : 'Move'}
          </button>
          <button type="button" className="btn" disabled={pending} style={{ fontSize: 12 }} onClick={() => setShowMove(false)}>
            Cancel
          </button>
        </form>
      )}
      {error && <p className="error-text" style={{ marginTop: 4 }}>{error}</p>}
    </div>
  );
}
