'use client';

import { useRef, useState, useTransition } from 'react';
import { updateClubProfile } from './actions';

/**
 * Gap analysis P0-6/P0-9. This was a one-field rename form -- `about`,
 * `location`, and a logo are all genuinely new capability, not a relabel;
 * kept in this file (renamed conceptually, not on disk, to keep the diff to
 * the component that already owns this slot in page.tsx) since it's the
 * same "click to expand, save, or cancel" shape as the original rename
 * form, just wider.
 */
export default function EditNameForm({
  clubId,
  initialName,
  initialAbout,
  initialLocation,
  logoUrl,
}: {
  clubId: string;
  initialName: string;
  initialAbout: string | null;
  initialLocation: string | null;
  logoUrl: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateClubProfile(clubId, formData);
      if (result?.error) setError(result.error);
      else setEditing(false);
    });
  }

  function handleRemoveLogo() {
    setError(null);
    const fd = new FormData();
    fd.set('name', initialName);
    fd.set('about', initialAbout ?? '');
    fd.set('location', initialLocation ?? '');
    fd.set('removeLogo', 'true');
    startTransition(async () => {
      const result = await updateClubProfile(clubId, fd);
      if (result?.error) setError(result.error);
    });
  }

  if (!editing) {
    return (
      <button className="btn" onClick={() => setEditing(true)} style={{ fontSize: 12.5 }}>
        Edit profile
      </button>
    );
  }

  return (
    <form ref={formRef} action={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
      <div className="form-group">
        <label style={{ fontSize: 11.5 }}>Name</label>
        <input name="name" defaultValue={initialName} required />
      </div>
      <div className="form-group">
        <label style={{ fontSize: 11.5 }}>About</label>
        <textarea name="about" defaultValue={initialAbout ?? ''} rows={3} style={{ resize: 'vertical' }} />
      </div>
      <div className="form-group">
        <label style={{ fontSize: 11.5 }}>Location</label>
        <input name="location" defaultValue={initialLocation ?? ''} />
      </div>
      <div className="form-group">
        <label style={{ fontSize: 11.5 }}>Logo</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a
            // signed R2 URL, not something next/image's optimizer can cache.
            <img src={logoUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
          )}
          <input name="logo" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" style={{ fontSize: 12.5 }} />
          {logoUrl && (
            <button type="button" className="btn" style={{ fontSize: 11.5 }} onClick={handleRemoveLogo} disabled={pending}>
              Remove
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn" onClick={() => setEditing(false)} disabled={pending}>
          Cancel
        </button>
      </div>
      {error && <span className="error-text">{error}</span>}
    </form>
  );
}
