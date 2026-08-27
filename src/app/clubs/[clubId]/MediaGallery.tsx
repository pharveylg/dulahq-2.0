'use client';

import { useRef, useState, useTransition } from 'react';
import { uploadMedia, deleteMedia } from './media-actions';

type MediaItem = { id: string; url: string; fileName: string; caption: string | null };

export default function MediaGallery({ clubId, items, canManage }: { clubId: string; items: MediaItem[]; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleUpload(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadMedia(clubId, formData);
      if (result?.error) setError(result.error);
      else formRef.current?.reset();
    });
  }

  function handleDelete(mediaId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteMedia(clubId, mediaId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="card">
      {items.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No photos yet.</p>}
      {items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
          {items.map((m) => (
            <div key={m.id} style={{ position: 'relative' }}>
              <img
                src={m.url}
                alt={m.caption ?? m.fileName}
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
              />
              {m.caption && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.caption}
                </div>
              )}
              {canManage && (
                <button
                  onClick={() => handleDelete(m.id)}
                  disabled={pending}
                  aria-label="Delete photo"
                  style={{
                    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%',
                    border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', fontSize: 13, lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <form ref={formRef} action={handleUpload} className="form-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
            <input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
            <input name="caption" placeholder="Caption (optional)" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Uploading…' : 'Upload photo'}
          </button>
        </form>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
