'use client';

import { useState, useTransition } from 'react';
import { addTransportation, removeTransportation } from './actions';

type Transport = { id: string; description: string | null; pickupPoint: string | null; dropoffPoint: string | null };

export default function TransportationList({
  clubId,
  tripId,
  transportation,
  canManage,
}: {
  clubId: string;
  tripId: string;
  transportation: Transport[];
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addTransportation(clubId, tripId, formData);
      if (result?.error) setError(result.error);
      else setShowAdd(false);
    });
  }

  function handleRemove(transportId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeTransportation(clubId, tripId, transportId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="section-label">Transportation ({transportation.length})</div>
      {transportation.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No vehicles added yet.</p>}
      {transportation.map((t) => (
        <div key={t.id} className="list-row">
          <div className="list-row-main">
            <div className="list-row-title">{t.description || 'Vehicle'}</div>
            {(t.pickupPoint || t.dropoffPoint) && (
              <div className="list-row-meta">
                {t.pickupPoint && `Pickup: ${t.pickupPoint}`}
                {t.pickupPoint && t.dropoffPoint && ' · '}
                {t.dropoffPoint && `Dropoff: ${t.dropoffPoint}`}
              </div>
            )}
          </div>
          {canManage && (
            <button className="btn" style={{ fontSize: 12 }} onClick={() => handleRemove(t.id)} disabled={pending}>
              Remove
            </button>
          )}
        </div>
      ))}

      {canManage && !showAdd && (
        <button className="btn" style={{ marginTop: 12, fontSize: 12 }} onClick={() => setShowAdd(true)}>
          + Add vehicle
        </button>
      )}
      {canManage && showAdd && (
        <form action={handleAdd} className="form-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
            <input name="description" placeholder="Vehicle (e.g. Van 1, plate ABC-123)" />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 130 }}>
            <input name="pickupPoint" placeholder="Pickup point" />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 130 }}>
            <input name="dropoffPoint" placeholder="Dropoff point" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
