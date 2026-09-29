'use client';

import { useRef, useState, useTransition } from 'react';
import { uploadTournamentPoster, removeTournamentPoster } from '@/lib/tournament-poster-actions';

/**
 * Shared by the organizer console (Public listing tab), the platform console
 * (Listings tab), and any future org-admin surface -- one component, one pair of
 * actions, so all three stay in sync with what set_tournament_poster actually allows.
 */
export default function TournamentPosterUpload({
  tournamentId,
  orgSlug,
  tournamentSlug,
  posterUrl,
  canManage,
}: {
  tournamentId: string;
  orgSlug: string;
  tournamentSlug: string;
  posterUrl: string | null;
  canManage: boolean;
}) {
  const [preview, setPreview] = useState(posterUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function pick() {
    inputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set('file', file);
    startTransition(async () => {
      const r = await uploadTournamentPoster(tournamentId, orgSlug, tournamentSlug, formData);
      if (r?.error) setError(r.error); else if (r?.posterUrl) setPreview(r.posterUrl);
      if (inputRef.current) inputRef.current.value = '';
    });
  }

  function remove() {
    if (!window.confirm('Remove this poster? It goes back to the generated placeholder.')) return;
    setError(null);
    startTransition(async () => {
      const r = await removeTournamentPoster(tournamentId, orgSlug, tournamentSlug);
      if (r?.error) setError(r.error); else setPreview(null);
    });
  }

  return (
    <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div
        style={{
          width: 84, height: 126, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
          background: 'var(--surface-muted)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Tournament poster" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 6 }}>No poster</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div className="section-label" style={{ marginBottom: 4 }}>Poster</div>
        <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--text-muted)' }}>
          Shown as a 2:3 card on the public tournament directory. PNG, JPEG, WEBP or GIF, up to 5MB.
          {!preview && ' Without one, a generated placeholder is shown instead.'}
        </p>
        {canManage ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input ref={inputRef} type="file" accept={ALLOWED_ACCEPT} onChange={onFile} style={{ display: 'none' }} />
            <button type="button" className="btn" disabled={pending} onClick={pick}>
              {pending ? 'Working…' : preview ? 'Replace poster' : 'Upload poster'}
            </button>
            {preview && (
              <button type="button" className="btn" disabled={pending} onClick={remove}>Remove</button>
            )}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Only the organizer or an admin can change this.</p>
        )}
        {error && <p className="error-text" role="alert" style={{ marginTop: 8 }}>{error}</p>}
      </div>
    </div>
  );
}

const ALLOWED_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
