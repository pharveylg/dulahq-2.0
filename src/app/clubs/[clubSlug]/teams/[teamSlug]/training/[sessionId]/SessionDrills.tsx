'use client';

import { useState, useTransition } from 'react';
import { attachDrill, detachDrill } from './actions';

type ClubDrill = { id: string; name: string; category: string };
type Attached = { id: string; drillId: string; name: string; category: string };

export default function SessionDrills({
  sessionId, clubDrills, attached, canManage,
}: {
  sessionId: string; clubDrills: ClubDrill[]; attached: Attached[]; canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState('');

  const attachedIds = new Set(attached.map((a) => a.drillId));
  const available = clubDrills.filter((d) => !attachedIds.has(d.id));

  function handleAttach() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await attachDrill(sessionId, selected);
      if (result?.error) setError(result.error);
      else setSelected('');
    });
  }

  function handleDetach(sessionDrillId: string) {
    setError(null);
    startTransition(async () => {
      const result = await detachDrill(sessionDrillId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="card">
      {attached.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No drills attached yet.</p>}
      {attached.map((a) => (
        <div key={a.id} className="list-row">
          <span className="list-row-title">{a.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="chip">{a.category}</span>
            {canManage && (
              <button className="btn" style={{ fontSize: 11 }} onClick={() => handleDetach(a.id)} disabled={pending}>Remove</button>
            )}
          </div>
        </div>
      ))}

      {canManage && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ flex: 1, minWidth: 180 }}>
            <option value="">Add a drill from the library…</option>
            {available.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.category})</option>)}
          </select>
          <button className="btn btn-primary" onClick={handleAttach} disabled={pending || !selected}>Add</button>
        </div>
      )}
      {error && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
