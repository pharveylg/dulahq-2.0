'use client';

import { useState, useTransition } from 'react';
import { addPassenger, removePassenger } from './actions';

type Passenger = { id: string; playerId: string; playerName: string; seat: string | null };
type PlayerOption = { id: string; name: string };

export default function PassengerList({
  clubId,
  tripId,
  passengers,
  availablePlayers,
  canManage,
}: {
  clubId: string;
  tripId: string;
  passengers: Passenger[];
  availablePlayers: PlayerOption[];
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addPassenger(clubId, tripId, formData);
      if (result?.error) setError(result.error);
    });
  }

  function handleRemove(passengerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removePassenger(clubId, tripId, passengerId);
      if (result?.error) setError(result.error);
    });
  }

  const passengerPlayerIds = new Set(passengers.map((p) => p.playerId));
  const eligiblePlayers = availablePlayers.filter((p) => !passengerPlayerIds.has(p.id));

  return (
    <div className="card">
      <div className="section-label">Passengers ({passengers.length})</div>
      {passengers.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nobody added yet.</p>}
      {passengers.map((p) => (
        <div key={p.id} className="list-row">
          <div className="list-row-main">
            <div className="list-row-title">{p.playerName}</div>
            {p.seat && <div className="list-row-meta">Seat {p.seat}</div>}
          </div>
          {canManage && (
            <button className="btn" style={{ fontSize: 12 }} onClick={() => handleRemove(p.id)} disabled={pending}>
              Remove
            </button>
          )}
        </div>
      ))}

      {canManage && eligiblePlayers.length > 0 && (
        <form action={handleAdd} className="form-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 2, minWidth: 160 }}>
            <select name="playerId" required defaultValue="">
              <option value="" disabled>Choose a player…</option>
              {eligiblePlayers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 90 }}>
            <input name="seat" placeholder="Seat (optional)" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
