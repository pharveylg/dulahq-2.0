'use client';

import { useState, useTransition } from 'react';
import { uploadPlayerPhoto, removePlayerPhoto } from '@/lib/player-photo-actions';

export default function PlayerPhotoField({
  playerId,
  name,
  photoUrl,
  canEdit,
}: {
  playerId: string;
  name: string;
  photoUrl: string | null;
  canEdit: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [version, setVersion] = useState(0);

  function handleUpload(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadPlayerPhoto(playerId, formData);
      if (result?.error) setError(result.error);
      else setVersion((v) => v + 1);
    });
  }

  function handleRemove() {
    if (!window.confirm('Remove this photo?')) return;
    setError(null);
    startTransition(async () => {
      const result = await removePlayerPhoto(playerId);
      if (result?.error) setError(result.error);
      else setVersion((v) => v + 1);
    });
  }

  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed R2 URL, which next/image cannot optimize
        <img
          key={version}
          src={photoUrl}
          alt={`Photo of ${name}`}
          style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
        />
      ) : (
        <div
          aria-label="No photo"
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            color: 'var(--text-muted)',
          }}
        >
          {initials}
        </div>
      )}
      {canEdit && (
        <form action={handleUpload} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required style={{ fontSize: 12 }} />
          <button type="submit" className="btn" disabled={pending} style={{ fontSize: 12 }}>
            {pending ? 'Uploading…' : photoUrl ? 'Replace photo' : 'Upload photo'}
          </button>
          {photoUrl && (
            <button type="button" className="btn" disabled={pending} onClick={handleRemove} style={{ fontSize: 12 }}>
              Remove
            </button>
          )}
        </form>
      )}
      {error && <span className="error-text" style={{ fontSize: 12 }}>{error}</span>}
    </div>
  );
}
