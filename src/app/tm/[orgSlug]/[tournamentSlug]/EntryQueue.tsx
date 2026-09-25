'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { addEntry, decideEntry, addEntryNote, resolveEntryNote } from './actions';
import { formatMoney } from '@/lib/currency';

export type EntryContact = { name: string; email: string; role: string; accountStatus: string };
export type EntryNote = { id: string; kind: 'note' | 'flag'; body: string; resolved: boolean; mine: boolean; author: string | null; createdAt: string };
export type Entry = {
  id: string;
  teamName: string;
  status: string;
  categoryName: string | null;
  clubBacked: boolean;
  createdAt: string;
  contacts: EntryContact[];
  notes: EntryNote[];
};
export type CategoryOption = { id: string; name: string; entryFee: number | null; capacity: number | null; taken: number };

type FormState = { error?: string; success?: boolean; warnings?: string[] };
const STATUS_FILTERS = ['pending', 'accepted', 'declined', 'flagged', 'all'] as const;
const openFlags = (e: Entry) => e.notes.filter((n) => n.kind === 'flag' && !n.resolved).length;

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  accepted: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' },
  declined: { color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'var(--danger-soft-border)' },
  pending: { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' },
};

function NotesPanel({ entry, canDecide }: { entry: Entry; canDecide: boolean }) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(kind: 'note' | 'flag') {
    setError(null);
    startTransition(async () => {
      const r = await addEntryNote(entry.id, kind, body);
      if (r?.error) setError(r.error); else setBody('');
    });
  }
  function resolve(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await resolveEntryNote(id);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'grid', gap: 6 }}>
      {entry.notes.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No notes yet.</div>}
      {entry.notes.map((n) => (
        <div key={n.id} style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', opacity: n.resolved ? 0.6 : 1 }}>
          <span className="chip" style={n.kind === 'flag' && !n.resolved ? STATUS_STYLE.pending : undefined}>
            {n.kind === 'flag' ? (n.resolved ? 'flag resolved' : 'flag') : 'note'}
          </span>
          <span>{n.body}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{n.author ?? 'someone'} · {new Date(n.createdAt).toLocaleDateString()}</span>
          {n.kind === 'flag' && !n.resolved && (canDecide || n.mine) && (
            <button className="btn" style={{ fontSize: 11.5 }} disabled={pending} onClick={() => resolve(n.id)}>Resolve</button>
          )}
        </div>
      ))}
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Add a note for the organizer, or flag a problem" aria-label={`Note on ${entry.teamName}`} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn" style={{ fontSize: 12 }} disabled={pending} onClick={() => add('note')}>Add note</button>
        <button className="btn" style={{ fontSize: 12 }} disabled={pending} onClick={() => add('flag')}>Flag for the organizer</button>
      </div>
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}

function EntryRow({ entry, canDecide, canReview }: { entry: Entry; canDecide: boolean; canReview: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const flags = openFlags(entry);

  function decide(status: 'accepted' | 'declined') {
    if (status === 'declined' && !window.confirm(`Decline ${entry.teamName}?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await decideEntry(entry.id, status);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="list-row-main">
          <div className="list-row-title">
            {entry.teamName}{' '}
            <span className="chip" style={STATUS_STYLE[entry.status]}>{entry.status}</span>
            {flags > 0 && <span className="chip" style={STATUS_STYLE.pending}>{flags} open {flags === 1 ? 'flag' : 'flags'}</span>}
          </div>
          <div className="list-row-meta">
            {entry.categoryName ?? 'No category'} · {entry.clubBacked ? 'Dula HQ club' : 'External team'} ·{' '}
            {new Date(entry.createdAt).toLocaleDateString()}
          </div>
        </div>
        {canReview && (
          <button className="btn" style={{ fontSize: 12 }} onClick={() => setShowNotes((v) => !v)}>
            Notes{entry.notes.length ? ` (${entry.notes.length})` : ''}
          </button>
        )}
        {canDecide && entry.status === 'pending' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={pending} onClick={() => decide('accepted')}>Accept</button>
            <button className="btn" style={{ fontSize: 12 }} disabled={pending} onClick={() => decide('declined')}>Decline</button>
          </div>
        )}
      </div>
      {entry.contacts.length > 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', paddingLeft: 2 }}>
          {entry.contacts.map((c) => (
            <div key={c.email}>
              {c.name} · {c.email} · {c.role.replace('_', ' ')} · {c.accountStatus}
            </div>
          ))}
        </div>
      )}
      {canReview && (showNotes || flags > 0) && <NotesPanel entry={entry} canDecide={canDecide} />}
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}

function AddEntryForm({ tournamentId, categories }: { tournamentId: string; categories: CategoryOption[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (_prev, formData) => (await addEntry(tournamentId, formData)) ?? {},
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [categoryId, setCategoryId] = useState('');
  const category = categories.find((c) => c.id === categoryId);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setCategoryId('');
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card" style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
      <div className="section-label">Add an entry</div>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
        For a team that registered with you directly. It is recorded as pending — accepting it is a separate step.
      </p>
      <div className="form-row" style={{ flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 2, minWidth: 180 }}>
          <label>Team name</label>
          <input name="teamName" required />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
          <label>Category</label>
          <select name="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">No category</option>
            {categories.map((c) => {
              const full = c.capacity != null && c.taken >= c.capacity;
              return (
                <option key={c.id} value={c.id} disabled={full}>
                  {c.name}{c.entryFee ? ` · ${formatMoney(c.entryFee, 'PHP')}` : ''}{c.capacity != null ? ` · ${c.taken}/${c.capacity}` : ''}{full ? ' · full' : ''}
                </option>
              );
            })}
          </select>
        </div>
      </div>
      <div className="form-row" style={{ flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
          <label>Contact name</label>
          <input name="contactName" />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
          <label>Contact email</label>
          <input name="contactEmail" type="email" />
        </div>
        <div className="form-group" style={{ flex: 0, minWidth: 130 }}>
          <label>Contact role</label>
          <select name="contactRole" defaultValue="team_manager">
            <option value="team_manager">Team manager</option>
            <option value="coach">Coach</option>
          </select>
        </div>
      </div>
      {category?.entryFee ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" name="issueInvoice" defaultChecked />
          Issue a {formatMoney(category.entryFee, 'PHP')} registration-fee invoice
        </label>
      ) : null}
      {state?.error && <p className="error-text" style={{ margin: 0 }}>{state.error}</p>}
      {state?.success && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--accent)' }}>Entry added as pending.</p>
      )}
      {state?.warnings?.map((w) => <p key={w} className="error-text" style={{ margin: 0 }}>{w}</p>)}
      <button type="submit" className="btn btn-primary" disabled={pending} style={{ justifySelf: 'start' }}>
        {pending ? 'Adding…' : 'Add entry'}
      </button>
    </form>
  );
}

export default function EntryQueue({
  tournamentId,
  entries,
  categories,
  canDecide,
  canAdd,
  canReview,
}: {
  tournamentId: string;
  entries: Entry[];
  categories: CategoryOption[];
  canDecide: boolean;
  canAdd: boolean;
  canReview: boolean;
}) {
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>('pending');
  const [showForm, setShowForm] = useState(false);
  const count = (s: string) => entries.filter((e) => e.status === s).length;
  const visible = filter === 'all' ? entries : filter === 'flagged' ? entries.filter((e) => openFlags(e) > 0) : entries.filter((e) => e.status === filter);

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {STATUS_FILTERS.map((s) => (
          <button key={s} className={filter === s ? 'btn btn-primary' : 'btn'} style={{ fontSize: 12 }} onClick={() => setFilter(s)}>
            {s[0].toUpperCase() + s.slice(1)} ({s === 'all' ? entries.length : s === 'flagged' ? entries.filter((e) => openFlags(e) > 0).length : count(s)})
          </button>
        ))}
        {canAdd && (
          <button className="btn" style={{ fontSize: 12, marginLeft: 'auto' }} onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Close' : '+ Add entry'}
          </button>
        )}
      </div>

      {canAdd && showForm && <AddEntryForm tournamentId={tournamentId} categories={categories} />}

      <div className="card">
        {visible.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {filter === 'pending' ? 'No entries are waiting for a decision.' : `No ${filter === 'all' ? '' : filter + ' '}entries.`}
          </p>
        )}
        {visible.map((entry) => <EntryRow key={entry.id} entry={entry} canDecide={canDecide} canReview={canReview} />)}
      </div>
    </>
  );
}
