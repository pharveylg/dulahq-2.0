'use client';

import { useState, useTransition } from 'react';
import { useActionState } from 'react';
import { createAnnouncement, togglePin, deleteAnnouncement } from './announcements-actions';

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  teamId: string | null;
  teamName: string | null;
  pinned: boolean;
  createdAt: string;
};

type Team = { id: string; name: string };
type ActionState = { error?: string };
const initialState: ActionState = {};

const AUDIENCES = ['club', 'team', 'players', 'guardians', 'coaches', 'staff', 'tournament_participants', 'trip_participants'];

function AnnouncementRow({
  clubId,
  announcement,
  canEdit,
}: {
  clubId: string;
  announcement: Announcement;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleTogglePin() {
    setError(null);
    startTransition(async () => {
      const result = await togglePin(clubId, announcement.id, !announcement.pinned);
      if (result?.error) setError(result.error);
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAnnouncement(clubId, announcement.id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="list-row-main">
          <div className="list-row-title">
            {announcement.pinned && '📌 '}
            {announcement.title}
          </div>
          <div className="list-row-meta">
            {announcement.audience === 'team' && announcement.teamName ? announcement.teamName : announcement.audience}
            {' · '}
            {new Date(announcement.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </div>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" style={{ fontSize: 11 }} onClick={handleTogglePin} disabled={pending}>
              {announcement.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button className="btn" style={{ fontSize: 11 }} onClick={handleDelete} disabled={pending}>
              Delete
            </button>
          </div>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{announcement.body}</p>
      {error && <p className="error-text" style={{ marginTop: 0 }}>{error}</p>}
    </div>
  );
}

export default function Announcements({
  clubId,
  announcements,
  teams,
  canManage,
  isClubAdmin,
  assignedTeamIds,
}: {
  clubId: string;
  announcements: Announcement[];
  teams: Team[];
  /** Any club_staff role -- whether to show the post form at all. */
  canManage: boolean;
  /** Club admins can post any audience; everyone else only 'team', to their own assigned team(s) -- matches the RLS exactly. */
  isClubAdmin: boolean;
  assignedTeamIds: string[];
}) {
  const audienceOptions = isClubAdmin ? AUDIENCES : ['team'];
  const teamOptions = isClubAdmin ? teams : teams.filter((t) => assignedTeamIds.includes(t.id));

  const [audience, setAudience] = useState(audienceOptions[0]);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await createAnnouncement(clubId, formData)) ?? {},
    initialState
  );

  const sorted = [...announcements].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  function canEdit(a: Announcement) {
    return isClubAdmin || (a.audience === 'team' && !!a.teamId && assignedTeamIds.includes(a.teamId));
  }

  return (
    <div className="card">
      {sorted.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No announcements yet.</p>}
      {sorted.map((a) => (
        <AnnouncementRow key={a.id} clubId={clubId} announcement={a} canEdit={canEdit(a)} />
      ))}

      {canManage && (teamOptions.length > 0 || isClubAdmin) && (
        <form action={formAction} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input name="title" placeholder="Title" required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <textarea name="body" placeholder="Message" required rows={2} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-raised)', fontFamily: 'inherit', fontSize: 14 }} />
          </div>
          <div className="form-row" style={{ flexWrap: 'wrap' }}>
            {audienceOptions.length > 1 ? (
              <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
                <select name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
                  {audienceOptions.map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
                </select>
              </div>
            ) : (
              <input type="hidden" name="audience" value="team" />
            )}
            {audience === 'team' && (
              <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
                <select name="teamId" required defaultValue="">
                  <option value="" disabled>Choose a team…</option>
                  {teamOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
              <input type="checkbox" name="pinned" /> Pin
            </label>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? 'Posting…' : 'Post'}
            </button>
          </div>
          {state?.error && <span className="error-text">{state.error}</span>}
        </form>
      )}
      {canManage && !isClubAdmin && teamOptions.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 12 }}>
          You can post to teams you’re assigned to — ask a club admin to assign you to one first.
        </p>
      )}
    </div>
  );
}
