'use client';

import { useState, useTransition } from 'react';
import { setPlayerPublicListing, setPlayerPublicPhoto } from '@/lib/public-profile-actions';

export default function PublicListingToggle({
  playerId,
  playerName,
  initial,
  initialShowPhoto,
  hasPhoto,
}: {
  playerId: string;
  playerName: string;
  initial: boolean;
  initialShowPhoto: boolean;
  hasPhoto: boolean;
}) {
  const [shown, setShown] = useState(initial);
  const [showPhoto, setShowPhoto] = useState(initialShowPhoto);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleListing() {
    const next = !shown;
    setError(null);
    startTransition(async () => {
      const result = await setPlayerPublicListing(playerId, next);
      if (result?.error) setError(result.error);
      else setShown(next);
    });
  }

  function togglePhoto() {
    const next = !showPhoto;
    setError(null);
    startTransition(async () => {
      const result = await setPlayerPublicPhoto(playerId, next);
      if (result?.error) setError(result.error);
      else setShowPhoto(next);
    });
  }

  return (
    <div style={{ display: 'grid', gap: 6, padding: '8px 0' }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
        <input type="checkbox" checked={shown} disabled={pending} onChange={toggleListing} />
        <span>
          {playerName} <span style={{ color: 'var(--text-muted)' }}>— shown on the club&apos;s public roster</span>
        </span>
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, paddingLeft: 22, color: shown ? 'inherit' : 'var(--text-muted)' }}>
        <input type="checkbox" checked={showPhoto} disabled={pending || !hasPhoto} onChange={togglePhoto} />
        <span>
          Show photo publicly{' '}
          {!hasPhoto && <span style={{ color: 'var(--text-muted)' }}>— upload a photo first</span>}
        </span>
      </label>
      {error && <span className="error-text" style={{ fontSize: 12 }}>{error}</span>}
    </div>
  );
}
