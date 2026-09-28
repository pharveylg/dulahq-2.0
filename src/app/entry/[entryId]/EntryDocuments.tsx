'use client';

import { useRef, useState, useTransition } from 'react';
import { submitEntryDocument } from './documents-actions';

export type PortalDocument = { id: string; type: string; name: string; status: 'pending' | 'approved' | 'rejected'; review_note: string | null; uploaded_by_role: string | null; created_at: string };

const TYPE_LABEL: Record<string, string> = { waiver: 'Waiver', insurance: 'Insurance', roster_form: 'Roster form', other: 'Other' };
const STATUS_LABEL: Record<string, string> = { pending: 'Waiting for review', approved: 'Approved', rejected: 'Needs attention' };

export default function EntryDocuments({ entryId, documents, canUpload }: { entryId: string; documents: PortalDocument[]; canUpload: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await submitEntryDocument(entryId, formData);
      if (r?.error) setError(r.error); else formRef.current?.reset();
    });
  }

  return (
    <>
      <div className="section-label">Documents</div>
      <div className="card" style={{ marginBottom: 12 }}>
        {documents.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Nothing submitted yet.</p>}
        {documents.map((d) => (
          <div key={d.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="list-row-title">{d.name}</span>
              <span className="chip">{TYPE_LABEL[d.type] ?? d.type}</span>
              <span className="chip">{STATUS_LABEL[d.status]}</span>
            </div>
            <div className="list-row-meta">
              {d.uploaded_by_role === 'staff' ? 'Added by the organizer' : 'Submitted by you'} · {new Date(d.created_at).toLocaleDateString()}
              {d.status === 'rejected' && d.review_note ? ` — ${d.review_note}` : ''}
            </div>
          </div>
        ))}
      </div>

      {canUpload && (
        <form ref={formRef} onSubmit={submit} className="card" style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
          <div className="form-row" style={{ flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
              <label htmlFor="doc-type">Document type</label>
              <select id="doc-type" name="type" defaultValue="waiver">
                {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 2, minWidth: 180 }}>
              <label htmlFor="doc-name">Name</label>
              <input id="doc-name" name="name" placeholder="e.g. Signed waiver" required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="doc-file">File (PDF or image, up to 8MB)</label>
            <input id="doc-file" name="file" type="file" accept="application/pdf,image/*" required />
          </div>
          {error && <p className="error-text" role="alert" style={{ margin: 0 }}>{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={pending} style={{ justifySelf: 'start' }}>
            {pending ? 'Uploading…' : 'Submit document'}
          </button>
        </form>
      )}
    </>
  );
}
