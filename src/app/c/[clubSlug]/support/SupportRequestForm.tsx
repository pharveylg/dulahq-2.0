'use client';

import { useRef, useState, useTransition } from 'react';
import { createSupportRequest } from './actions';

const CATEGORIES = [
  { value: 'account_access', label: 'Account / access' },
  { value: 'billing', label: 'Billing' },
  { value: 'bug', label: 'Something looks broken' },
  { value: 'data', label: 'Data correction' },
  { value: 'feature_request', label: 'Feature request' },
  { value: 'other', label: 'Other' },
];

export default function SupportRequestForm({ clubId }: { clubId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createSupportRequest(clubId, formData);
      if (result?.error) setError(result.error);
      else {
        formRef.current?.reset();
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <button className="btn btn-primary" style={{ marginBottom: 20 }} onClick={() => setOpen(true)}>
        New request
      </button>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, maxWidth: 480 }}>
      <div className="form-group">
        <label style={{ fontSize: 11.5 }}>Category</label>
        <select name="category" defaultValue="other">
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label style={{ fontSize: 11.5 }}>Subject</label>
        <input name="subject" required maxLength={120} />
      </div>
      <div className="form-group">
        <label style={{ fontSize: 11.5 }}>Describe the issue</label>
        <textarea name="body" required rows={4} style={{ resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Sending…' : 'Send to Dulà HQ'}
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
      {error && <span className="error-text">{error}</span>}
    </form>
  );
}
