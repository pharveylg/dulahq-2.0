'use client';

import { useState, useTransition } from 'react';
import { setListingBlock } from '@/app/listing-actions';

export type ListingRow = {
  kind: 'club' | 'tournament';
  id: string;
  name: string;
  org: string;
  listed: boolean;
  blocked: boolean;
  reason: string | null;
};

/**
 * Platform override for the public directory (docs/proposals/public-listing.md).
 * Owners opt in; this is only for hiding something that shouldn't be public, with a
 * reason the owner sees. The owner's own setting is kept and applies again on
 * unblock.
 */
export default function Listings({ rows }: { rows: ListingRow[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'listed' | 'blocked'>('listed');

  const shown = rows.filter((r) => (filter === 'listed' ? r.listed : filter === 'blocked' ? r.blocked : true));

  function block(r: ListingRow) {
    const reason = window.prompt(`Why is “${r.name}” being hidden from the public directory? The owner will see this.`);
    if (!reason || !reason.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await setListingBlock(r.kind, r.id, true, reason.trim());
      if (res?.error) setError(res.error);
    });
  }

  function unblock(r: ListingRow) {
    if (!window.confirm(`Lift the block on “${r.name}”?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await setListingBlock(r.kind, r.id, false, null);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['listed', 'blocked', 'all'] as const).map((f) => (
          <button key={f} className={filter === f ? 'btn btn-primary' : 'btn'} onClick={() => setFilter(f)}>
            {f === 'listed' ? 'Listed' : f === 'blocked' ? 'Blocked' : 'Everything'}
          </button>
        ))}
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="card">
        {shown.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Nothing here.</p>}
        {shown.map((r) => (
          <div key={`${r.kind}-${r.id}`} className="list-row">
            <div className="list-row-main">
              <div className="list-row-title">{r.name}</div>
              <div className="list-row-meta">
                {r.kind} · {r.org}
                {r.blocked && r.reason ? ` · blocked: ${r.reason}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="chip">{r.blocked ? 'blocked' : r.listed ? 'listed' : 'private'}</span>
              {r.blocked ? (
                <button className="btn" disabled={pending} onClick={() => unblock(r)}>Unblock</button>
              ) : (
                <button className="btn" disabled={pending} onClick={() => block(r)}>Block</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
