'use client';

import { useState, useTransition } from 'react';
import { reviewEntryDocument, deleteEntryDocument, staffUploadEntryDocument } from './actions';

export type ConsoleDocument = {
  id: string; entryId: string; teamName: string; type: string; name: string;
  status: 'pending' | 'approved' | 'rejected'; reviewNote: string | null;
  uploadedByRole: string | null; createdAt: string;
};
export type EntryOption = { id: string; teamName: string };

const TYPE_LABEL: Record<string, string> = { waiver: 'Waiver', insurance: 'Insurance', roster_form: 'Roster form', other: 'Other' };
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  approved: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' },
  rejected: { color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'var(--danger-soft-border)' },
  pending: { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' },
};
const FILTERS = ['pending', 'approved', 'rejected', 'all'] as const;

function DocRow({ doc, canReview }: { doc: ConsoleDocument; canReview: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  function approve() {
    setError(null);
    startTransition(async () => {
      const r = await reviewEntryDocument(doc.id, 'approved');
      if (r?.error) setError(r.error);
    });
  }
  function reject(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await reviewEntryDocument(doc.id, 'rejected', (fd.get('note') as string) ?? '');
      if (r?.error) setError(r.error); else setRejecting(false);
    });
  }
  function remove() {
    if (!window.confirm(`Remove "${doc.name}"?`)) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteEntryDocument(doc.id);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="list-row-title">{doc.teamName}</span>
        <span className="chip">{TYPE_LABEL[doc.type] ?? doc.type}</span>
        <span className="chip" style={STATUS_STYLE[doc.status]}>{doc.status}</span>
        {doc.uploadedByRole === 'staff' && <span className="chip">added by staff</span>}
      </div>
      <div className="list-row-meta">{doc.name} · {new Date(doc.createdAt).toLocaleDateString()}{doc.status === 'rejected' && doc.reviewNote ? ` — ${doc.reviewNote}` : ''}</div>
      {canReview && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {doc.status !== 'approved' && <button className="btn btn-primary" style={{ fontSize: 11.5 }} disabled={pending} onClick={approve}>Approve</button>}
          {doc.status !== 'rejected' && !rejecting && <button className="btn" style={{ fontSize: 11.5 }} disabled={pending} onClick={() => setRejecting(true)}>Reject</button>}
          {rejecting && (
            <form action={reject} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input name="note" placeholder="Reason (required)" required style={{ fontSize: 12, minWidth: 160 }} />
              <button type="submit" className="btn" style={{ fontSize: 11.5 }} disabled={pending}>Confirm reject</button>
              <button type="button" className="btn" style={{ fontSize: 11.5 }} onClick={() => setRejecting(false)}>Cancel</button>
            </form>
          )}
          <button className="btn" style={{ fontSize: 11.5, marginLeft: 'auto' }} disabled={pending} onClick={remove}>Remove</button>
        </div>
      )}
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}

function StaffUploadForm({ entries }: { entries: EntryOption[] }) {
  const [entryId, setEntryId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('waiver');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await staffUploadEntryDocument(entryId, formData);
      if (r?.error) setError(r.error); else { setName(''); (e.target as HTMLFormElement).reset(); }
    });
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
      <div className="section-label">Add a document on a team's behalf</div>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
        For paperwork a team sent you some other way (email, in person).
      </p>
      <div className="form-row" style={{ flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 2, minWidth: 180 }}>
          <label htmlFor="staff-doc-entry">Team</label>
          <select id="staff-doc-entry" value={entryId} onChange={(e) => setEntryId(e.target.value)} required>
            <option value="" disabled>Choose a team…</option>
            {entries.map((e) => <option key={e.id} value={e.id}>{e.teamName}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
          <label htmlFor="staff-doc-type">Type</label>
          <select id="staff-doc-type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 2, minWidth: 180 }}>
          <label htmlFor="staff-doc-name">Name</label>
          <input id="staff-doc-name" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="staff-doc-file">File (PDF or image, up to 8MB)</label>
        <input id="staff-doc-file" name="file" type="file" accept="application/pdf,image/*" required />
      </div>
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={pending} style={{ justifySelf: 'start' }}>
        {pending ? 'Adding…' : 'Add document'}
      </button>
    </form>
  );
}

export default function Documents({ documents, entries, canReview }: { documents: ConsoleDocument[]; entries: EntryOption[]; canReview: boolean }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('pending');
  const visible = filter === 'all' ? documents : documents.filter((d) => d.status === filter);

  return (
    <>
      {canReview && <StaffUploadForm entries={entries} />}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? 'btn btn-primary' : 'btn'} style={{ fontSize: 12 }} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)} ({f === 'all' ? documents.length : documents.filter((d) => d.status === f).length})
          </button>
        ))}
      </div>
      <div className="card">
        {visible.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Nothing here.</p>}
        {visible.map((d) => <DocRow key={d.id} doc={d} canReview={canReview} />)}
      </div>
    </>
  );
}
