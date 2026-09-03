'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loadDemoData, wipeDemoData } from './demo-actions';

export default function DemoDataControls({ hasDemoData }: { hasDemoData: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleLoad() {
    setError(null);
    startTransition(async () => {
      const result = await loadDemoData();
      if (result?.error) setError(result.error);
      else if (result?.clubSlug) router.push(`/clubs/${result.clubSlug}`);
      else router.refresh();
    });
  }

  function handleWipe() {
    setError(null);
    startTransition(async () => {
      const result = await wipeDemoData();
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="card" style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div className="section-label" style={{ marginBottom: 4 }}>Demo data</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          {hasDemoData
            ? 'Riverside FC (Demo) is loaded — 2 teams, 10 players, a few guardians.'
            : 'Nothing loaded. Seed a sample club with rosters and guardians to try things out.'}
        </p>
        {error && <p className="error-text">{error}</p>}
      </div>
      <button className="btn" onClick={hasDemoData ? handleWipe : handleLoad} disabled={pending}>
        {pending ? 'Working…' : hasDemoData ? 'Wipe demo data' : 'Load demo data'}
      </button>
    </div>
  );
}
