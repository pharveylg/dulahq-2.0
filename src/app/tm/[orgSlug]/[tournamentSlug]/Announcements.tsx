'use client';

import { useState, useTransition } from 'react';
import { postAnnouncement, retractAnnouncement } from './actions';

export type AnnouncementRow = { id: string; title: string; body: string; audience: 'all' | 'accepted'; authorName: string | null; createdAt: string; retracted: boolean };

/**
 * Posts to the teams entered in this tournament: it appears on their entry page and in
 * their notification bell. Declined and withdrawn teams are never addressed. A post can't
 * be edited; retract it and post again.
 */
export default function Announcements({ tournamentId, rows, canPost }: { tournamentId: string; rows: AnnouncementRow[]; canPost: boolean }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'accepted'>('all');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function post(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await postAnnouncement(tournamentId, title, body, audience);
      if (r?.error) setError(r.error); else { setTitle(''); setBody(''); }
    });
  }
  function retract(id: string) {
    if (!window.confirm('Retract this announcement? Teams stop seeing it; the notification they already got stays.')) return;
    setError(null);
    startTransition(async () => {
      const r = await retractAnnouncement(id);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <>
      {canPost && (
        <form onSubmit={post} className="card" style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          <div className="section-label">Post to teams</div>
          <div className="form-row" style={{ flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 3, minWidth: 200 }}>
              <label htmlFor="ann-title">Title</label>
              <input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="ann-aud">Who gets it</label>
              <select id="ann-aud" value={audience} onChange={(e) => setAudience(e.target.value as 'all' | 'accepted')}>
                <option value="all">Every team not declined</option>
                <option value="accepted">Accepted teams only</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="ann-body">Message</label>
            <textarea id="ann-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>
          {error && <p className="error-text" role="alert" style={{ margin: 0 }}>{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={pending} style={{ justifySelf: 'start' }}>
            {pending ? 'Posting…' : 'Post announcement'}
          </button>
        </form>
      )}
      <div className="card">
        {rows.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Nothing posted yet.</p>}
        {rows.map((a) => (
          <div key={a.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4, opacity: a.retracted ? 0.55 : 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="list-row-title">{a.title}</span>
              <span className="chip">{a.audience === 'accepted' ? 'accepted teams' : 'all teams'}</span>
              {a.retracted && <span className="chip">retracted</span>}
              {canPost && !a.retracted && (
                <button className="btn" style={{ fontSize: 11.5, marginLeft: 'auto' }} disabled={pending} onClick={() => retract(a.id)}>Retract</button>
              )}
            </div>
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{a.body}</div>
            <div className="list-row-meta">{a.authorName ?? 'someone'} · {new Date(a.createdAt).toLocaleString()}</div>
          </div>
        ))}
        {!canPost && rows.length > 0 && error && <p className="error-text">{error}</p>}
      </div>
    </>
  );
}
