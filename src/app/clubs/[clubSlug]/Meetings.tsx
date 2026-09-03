'use client';

import { useState, useTransition, useActionState } from 'react';
import {
  createMeeting,
  updateMeetingNotes,
  updateMeetingStatus,
  deleteMeeting,
  addActionItem,
  toggleActionItem,
  deleteActionItem,
} from './meetings-actions';

type ActionItem = { id: string; description: string; dueDate: string | null; status: 'open' | 'done' };
type Meeting = {
  id: string;
  title: string;
  meetingDate: string;
  location: string | null;
  notes: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  actionItems: ActionItem[];
};

type ActionState = { error?: string };
const initialState: ActionState = {};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  scheduled: { color: 'var(--blue)', background: 'var(--blue-soft)', borderColor: 'var(--blue-soft-border)' },
  completed: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' },
  cancelled: { color: 'var(--text-muted)' },
};

function MeetingRow({ meeting, canManage }: { meeting: Meeting; canManage: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(meeting.notes ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSaveNotes() {
    setError(null);
    startTransition(async () => {
      const result = await updateMeetingNotes(meeting.id, notes);
      if (result?.error) setError(result.error);
    });
  }

  function handleStatus(status: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateMeetingStatus(meeting.id, status);
      if (result?.error) setError(result.error);
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteMeeting(meeting.id);
      if (result?.error) setError(result.error);
    });
  }

  function handleAddItem(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addActionItem(meeting.id, formData);
      if (result?.error) setError(result.error);
    });
  }

  function handleToggleItem(itemId: string, current: 'open' | 'done') {
    startTransition(async () => {
      await toggleActionItem(itemId, current === 'open' ? 'done' : 'open');
    });
  }

  function handleDeleteItem(itemId: string) {
    startTransition(async () => {
      await deleteActionItem(itemId);
    });
  }

  const openCount = meeting.actionItems.filter((a) => a.status === 'open').length;

  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }} onClick={() => setExpanded((v) => !v)}>
        <div className="list-row-main">
          <div className="list-row-title">{meeting.title}</div>
          <div className="list-row-meta">
            {new Date(meeting.meetingDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            {meeting.location ? ` · ${meeting.location}` : ''}
            {openCount > 0 ? ` · ${openCount} open action item${openCount === 1 ? '' : 's'}` : ''}
          </div>
        </div>
        <span className="chip" style={STATUS_STYLE[meeting.status]}>{meeting.status}</span>
      </div>

      {expanded && (
        <div style={{ paddingLeft: 2 }}>
          {canManage && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {['scheduled', 'completed', 'cancelled'].map((s) => (
                <button key={s} className="btn" style={{ fontSize: 11 }} onClick={() => handleStatus(s)} disabled={pending}>
                  {s}
                </button>
              ))}
              <button className="btn" style={{ fontSize: 11 }} onClick={handleDelete} disabled={pending}>Delete</button>
            </div>
          )}

          <div className="section-label" style={{ fontSize: 11 }}>Notes</div>
          {canManage ? (
            <>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Meeting notes…"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-raised)', fontFamily: 'inherit', fontSize: 13.5, marginBottom: 8 }}
              />
              <button className="btn" style={{ fontSize: 11.5, marginBottom: 16 }} onClick={handleSaveNotes} disabled={pending}>
                {pending ? 'Saving…' : 'Save notes'}
              </button>
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{meeting.notes || 'No notes yet.'}</p>
          )}

          <div className="section-label" style={{ fontSize: 11 }}>Action items</div>
          {meeting.actionItems.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>None yet.</p>}
          {meeting.actionItems.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, textDecoration: item.status === 'done' ? 'line-through' : 'none', color: item.status === 'done' ? 'var(--text-muted)' : 'var(--text)' }}>
                <input type="checkbox" checked={item.status === 'done'} onChange={() => handleToggleItem(item.id, item.status)} disabled={!canManage || pending} />
                {item.description}
                {item.dueDate && <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}> — due {new Date(item.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
              </label>
              {canManage && (
                <button onClick={() => handleDeleteItem(item.id)} disabled={pending} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>
                  Remove
                </button>
              )}
            </div>
          ))}

          {canManage && (
            <form action={handleAddItem} className="form-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 2, minWidth: 160 }}>
                <input name="description" placeholder="Action item" required />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
                <input name="dueDate" type="date" />
              </div>
              <button type="submit" className="btn" style={{ fontSize: 12 }} disabled={pending}>+ Add</button>
            </form>
          )}
        </div>
      )}
      {error && <p className="error-text" style={{ marginTop: 0 }}>{error}</p>}
    </div>
  );
}

export default function Meetings({ clubId, meetings, canManage }: { clubId: string; meetings: Meeting[]; canManage: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await createMeeting(clubId, formData)) ?? {},
    initialState
  );
  const [showForm, setShowForm] = useState(false);

  const sorted = [...meetings].sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());

  return (
    <>
      <div className="card">
        {sorted.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No meetings yet.</p>}
        {sorted.map((m) => <MeetingRow key={m.id} meeting={m} canManage={canManage} />)}
      </div>

      {canManage && (
        <div style={{ marginTop: 12 }}>
          {!showForm ? (
            <button className="btn" onClick={() => setShowForm(true)}>+ New meeting</button>
          ) : (
            <form action={formAction} className="form-row" style={{ flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 2, minWidth: 160 }}>
                <input name="title" placeholder="Meeting title" required />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
                <input name="meetingDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
                <input name="location" placeholder="Location / link" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Creating…' : 'Create'}</button>
              {state?.error && <span className="error-text">{state.error}</span>}
            </form>
          )}
        </div>
      )}
    </>
  );
}
