'use client';

import { useState, useTransition } from 'react';
import { setPlayerPublicListing } from '@/lib/public-profile-actions';

export default function PublicListingToggle({
  playerId,
  playerName,
  initial,
}: {
  playerId: string;
  playerName: string;
  initial: boolean;
}) {
  const [shown, setShown] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !shown;
    setError(null);
    startTransition(async () => {
      const result = await setPlayerPublicListing(playerId, next);
      if (result?.error) setError(result.error);
      else setShown(next);
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, flex: 1, minWidth: 180 }}>
        <input type="checkbox" checked={shown} disabled={pending} onChange={toggle} />
        <span>
          {playerName} <span style={{ color: 'var(--text-muted)' }}>— shown on the club&apos;s public roster</span>
        </span>
      </label>
      {error && <span className="error-text" style={{ fontSize: 12 }}>{error}</span>}
    </div>
  );
}
