'use client';

import { useState, useTransition } from 'react';
import { setPublicListing } from '@/app/listing-actions';

export type ListingPreview = {
  /** What the directory shows, as label -> value. A missing value renders as a warning. */
  fields: { label: string; value: string | null }[];
};

/**
 * The owner's opt-in to the public directory (docs/proposals/public-listing.md).
 * It says exactly what becomes public before anyone turns it on, warns about
 * empty fields, and says so plainly when the platform team has blocked the
 * listing (the owner's choice is kept underneath and comes back on unblock).
 */
export default function PublicListingCard({
  kind,
  id,
  listed,
  blocked,
  blockReason,
  canList,
  canUnlist,
  preview,
}: {
  kind: 'club' | 'tournament';
  id: string;
  listed: boolean;
  blocked: boolean;
  blockReason: string | null;
  /** May turn listing ON (IT admin role, org admin, platform admin). */
  canList: boolean;
  /** May turn it OFF (also anyone who administers the club / tournament). */
  canUnlist: boolean;
  preview: ListingPreview;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const noun = kind === 'club' ? 'club' : 'tournament';
  const missing = preview.fields.filter((f) => !f.value).map((f) => f.label.toLowerCase());

  function change(next: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await setPublicListing(kind, id, next);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="list-row-title">Public directory</div>
          <div className="list-row-meta">
            {blocked
              ? 'Hidden by the Dulà HQ platform team'
              : listed
                ? `This ${noun} is listed: anyone can find it, signed in or not.`
                : `This ${noun} is private: only its own people can find it.`}
          </div>
        </div>
        <span
          className="chip"
          style={
            blocked
              ? { color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'var(--danger-soft-border)' }
              : listed
                ? { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' }
                : undefined
          }
        >
          {blocked ? 'blocked' : listed ? 'listed' : 'private'}
        </span>
      </div>

      {blocked && (
        <p style={{ fontSize: 13, margin: '10px 0 0' }}>
          {blockReason ? `Reason: ${blockReason}. ` : ''}
          {listed ? 'Your listing setting is kept, and applies again once the block is lifted.' : ''} Contact the platform team to
          have it reviewed.
        </p>
      )}

      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '12px 0 4px' }}>What people see when listed:</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
        {preview.fields.map((f) => (
          <div key={f.label}>
            <span style={{ color: 'var(--text-muted)' }}>{f.label}: </span>
            {f.value ? f.value : <span style={{ color: 'var(--warn)' }}>not set</span>}
          </div>
        ))}
        <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
          Never shown: players, guardians, staff, fees, or anything else in the {noun}.
        </div>
      </div>

      {!listed && canList && missing.length > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--warn)', margin: '10px 0 0' }}>
          Not set yet: {missing.join(', ')}. You can list it anyway, but the tile will look empty.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        {!listed && canList && (
          <button className="btn btn-primary" onClick={() => change(true)} disabled={pending}>
            {pending ? 'Saving…' : 'List publicly'}
          </button>
        )}
        {listed && canUnlist && (
          <button className="btn" onClick={() => change(false)} disabled={pending}>
            {pending ? 'Saving…' : 'Remove from public directory'}
          </button>
        )}
        {!listed && !canList && (
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            Only the {noun}’s IT admin or an organization admin can list it.
          </span>
        )}
        {error && <span className="error-text">{error}</span>}
      </div>
    </div>
  );
}
