'use client';

import { useRef, useState, useTransition } from 'react';
import { uploadDocument, reviewDocument, deleteDocument } from '@/app/c/[clubSlug]/teams/[teamSlug]/documents-actions';

export type DocumentRow = {
  id: string;
  type: string;
  name: string;
  fileName: string | null;
  mimeType: string | null;
  status: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  uploadedAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  registration: 'Registration',
  code_of_conduct: 'Code of Conduct',
  consent_form: 'Consent Form',
  media_consent: 'Media Consent',
  tournament_waiver: 'Tournament Waiver',
  club_policy: 'Club Policy',
  other: 'Other',
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  pending: { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' },
  approved: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' },
  rejected: { color: 'var(--danger, #b3261e)' },
};

export default function Documents({
  clubId,
  teamId,
  playerId,
  playerName,
  documents,
  canManage,
}: {
  clubId: string;
  teamId: string;
  playerId: string;
  playerName: string;
  documents: DocumentRow[];
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleUpload(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadDocument(clubId, teamId, playerId, playerName, formData);
      if (result?.error) setError(result.error);
      else {
        setShowUpload(false);
        formRef.current?.reset();
      }
    });
  }

  function handleReview(documentId: string, status: 'approved' | 'rejected', note: string) {
    setError(null);
    startTransition(async () => {
      const result = await reviewDocument(documentId, playerId, status, note);
      if (result?.error) setError(result.error);
      else setReviewingId(null);
    });
  }

  function handleDelete(documentId: string) {
    setError(null);
    startTransition(() => {
      deleteDocument(documentId);
    });
  }

  const sorted = [...documents].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  return (
    <div className="card">
      {sorted.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No documents yet.</p>}

      {sorted.map((doc) => (
        <div key={doc.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div className="list-row-title">{doc.name}</div>
              <div className="list-row-meta">
                {TYPE_LABEL[doc.type] ?? doc.type} · {doc.fileName ?? 'no file'} ·{' '}
                {new Date(doc.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <span className="chip" style={STATUS_STYLE[doc.status]}>{doc.status}</span>
          </div>

          {doc.reviewNote && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
              {doc.reviewedBy ? `${doc.reviewedBy}: ` : ''}{doc.reviewNote}
            </p>
          )}

          {canManage && doc.status === 'pending' && reviewingId !== doc.id && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ fontSize: 11.5 }} disabled={pending} onClick={() => handleReview(doc.id, 'approved', '')}>
                Approve
              </button>
              <button className="btn" style={{ fontSize: 11.5 }} disabled={pending} onClick={() => setReviewingId(doc.id)}>
                Reject…
              </button>
            </div>
          )}

          {canManage && reviewingId === doc.id && (
            <form
              className="form-row"
              style={{ flexWrap: 'wrap' }}
              action={(fd) => handleReview(doc.id, 'rejected', (fd.get('note') as string) ?? '')}
            >
              <input name="note" placeholder="Reason (required)" required style={{ flex: 1, minWidth: 160 }} />
              <button type="submit" className="btn btn-primary" style={{ fontSize: 11.5 }} disabled={pending}>
                Confirm reject
              </button>
              <button type="button" className="btn" style={{ fontSize: 11.5 }} onClick={() => setReviewingId(null)}>
                Cancel
              </button>
            </form>
          )}

          {canManage && (
            <button className="btn" style={{ fontSize: 11, alignSelf: 'flex-start', color: 'var(--text-muted)' }} disabled={pending} onClick={() => handleDelete(doc.id)}>
              Remove
            </button>
          )}
        </div>
      ))}

      {canManage && !showUpload && (
        <button className="btn" style={{ fontSize: 11.5, marginTop: sorted.length ? 12 : 0 }} onClick={() => setShowUpload(true)}>
          + Upload document
        </button>
      )}
      {canManage && showUpload && (
        <form ref={formRef} action={handleUpload} className="form-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
            <select name="type" defaultValue="other">
              {Object.entries(TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
            <input name="name" placeholder="Document name" required />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
            <input name="file" type="file" required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending} style={{ fontSize: 12 }}>
            {pending ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      )}
      {error && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
