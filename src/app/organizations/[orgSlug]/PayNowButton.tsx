'use client';

import { useState, useTransition } from 'react';
import { requestProductUpgrade } from './actions';

export default function PayNowButton({ orgId, product, price }: { orgId: string; product: 'club' | 'tournament'; price: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await requestProductUpgrade(orgId, product);
      if (result?.error) setError(result.error);
      else setDone(result.status === 'paid' ? 'Activated.' : 'Invoice issued — awaiting payment.');
    });
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button type="button" className="btn" disabled={pending} onClick={handleClick} style={{ fontSize: 12.5 }}>
        {pending ? 'Working…' : `Pay now — ${price}`}
      </button>
      {done && <span style={{ fontSize: 12, color: 'var(--accent)' }}>{done}</span>}
      {error && <span className="error-text" style={{ fontSize: 12 }}>{error}</span>}
    </span>
  );
}
