'use client';

import { useState, useTransition } from 'react';
import { removePlayer, addGuardian, removeGuardianLink } from './actions';

type Guardian = {
  linkId: string;
  guardianId: string;
  name: string;
  relationship: string;
  isPrimaryContact: boolean;
  contactInfo: { phone?: string | null; email?: string | null } | null;
};

type Player = {
  id: string;
  name: string;
  jersey: string | null;
  position: string | null;
  age: string | null;
  guardians: Guardian[];
};

export default function PlayerRow({
  clubId,
  teamId,
  player,
  canManage,
}: {
  clubId: string;
  teamId: string;
  player: Player;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showGuardians, setShowGuardians] = useState(player.guardians.length > 0);
  const [showAddGuardian, setShowAddGuardian] = useState(false);

  function handleRemovePlayer() {
    setError(null);
    startTransition(async () => {
      const result = await removePlayer(clubId, teamId, player.id);
      if (result?.error) setError(result.error);
    });
  }

  function handleRemoveGuardian(linkId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeGuardianLink(clubId, teamId, linkId);
      if (result?.error) setError(result.error);
    });
  }

  function handleAddGuardian(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addGuardian(clubId, teamId, player.id, formData);
      if (result?.error) setError(result.error);
      else {
        setShowAddGuardian(false);
        setShowGuardians(true);
      }
    });
  }

  const meta = [player.jersey && `#${player.jersey}`, player.position, player.age && `${player.age}y`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="list-row-main">
          <div className="list-row-title">{player.name}</div>
          {meta && <div className="list-row-meta">{meta}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn" style={{ fontSize: 11.5 }} onClick={() => setShowGuardians((v) => !v)}>
            {player.guardians.length} guardian{player.guardians.length === 1 ? '' : 's'}
          </button>
          {canManage && (
            <button className="btn" onClick={handleRemovePlayer} disabled={pending} style={{ fontSize: 12 }}>
              Remove
            </button>
          )}
        </div>
      </div>

      {showGuardians && (
        <div style={{ paddingLeft: 2 }}>
          {player.guardians.map((g) => (
            <div
              key={g.linkId}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}
            >
              <span style={{ fontSize: 13 }}>
                {g.name}
                <span style={{ color: 'var(--text-muted)' }}>
                  {' '}
                  · {g.relationship}
                  {g.contactInfo?.phone ? ` · ${g.contactInfo.phone}` : ''}
                  {g.contactInfo?.email ? ` · ${g.contactInfo.email}` : ''}
                </span>
              </span>
              {canManage && (
                <button
                  onClick={() => handleRemoveGuardian(g.linkId)}
                  disabled={pending}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          {canManage && !showAddGuardian && (
            <button className="btn" style={{ fontSize: 11.5, marginTop: 6 }} onClick={() => setShowAddGuardian(true)}>
              + Add guardian
            </button>
          )}

          {canManage && showAddGuardian && (
            <form
              action={(fd) => handleAddGuardian(fd)}
              className="form-row"
              style={{ marginTop: 8, flexWrap: 'wrap' }}
            >
              <div className="form-group" style={{ flex: 2, minWidth: 130 }}>
                <input name="name" placeholder="Guardian name" required />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 110 }}>
                <select name="relationship" defaultValue="parent">
                  <option value="parent">Parent</option>
                  <option value="guardian">Guardian</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 110 }}>
                <input name="phone" placeholder="Phone" />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
                <input name="email" type="email" placeholder="Email" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={pending} style={{ fontSize: 12 }}>
                {pending ? 'Saving…' : 'Save'}
              </button>
            </form>
          )}
        </div>
      )}

      {error && <p className="error-text" style={{ marginTop: 0 }}>{error}</p>}
    </div>
  );
}
