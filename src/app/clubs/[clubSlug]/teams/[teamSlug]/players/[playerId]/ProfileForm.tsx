'use client';

import { useState, useTransition } from 'react';
import { updateProfile } from './actions';

type Player = {
  id: string;
  secondary_position: string | null;
  preferred_foot: string | null;
  dob: string | null;
  development_status: string;
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  on_track: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' },
  needs_attention: { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' },
  excelling: { color: 'var(--blue)', background: 'var(--blue-soft)', borderColor: 'var(--blue-soft-border)' },
};

export default function ProfileForm({ player, canManage }: { player: Player; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateProfile(player.id, formData);
      if (result?.error) setError(result.error);
      else setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="card" style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          {player.preferred_foot ? `${player.preferred_foot} footed` : 'Foot not set'}
          {player.dob ? ` · Born ${new Date(player.dob).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}` : ''}
          {' · '}
          <span className="chip" style={STATUS_STYLE[player.development_status]}>{player.development_status.replace('_', ' ')}</span>
        </div>
        {canManage && <button className="btn" style={{ fontSize: 11.5 }} onClick={() => setEditing(true)}>Edit profile</button>}
      </div>
    );
  }

  return (
    <form action={handleSave} className="card" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="form-row" style={{ flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
          <input name="secondaryPosition" placeholder="Secondary position" defaultValue={player.secondary_position ?? ''} />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 130, marginBottom: 0 }}>
          <select name="preferredFoot" defaultValue={player.preferred_foot ?? ''}>
            <option value="">Preferred foot</option>
            <option value="right">Right</option>
            <option value="left">Left</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
          <input name="dob" type="date" defaultValue={player.dob ?? ''} />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
          <select name="developmentStatus" defaultValue={player.development_status}>
            <option value="on_track">On track</option>
            <option value="needs_attention">Needs attention</option>
            <option value="excelling">Excelling</option>
          </select>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </form>
  );
}
