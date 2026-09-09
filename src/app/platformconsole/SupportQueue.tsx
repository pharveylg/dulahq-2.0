'use client';

import { useState, useTransition } from 'react';
import { updateSupportRequestStatus, platformReplySupportRequest } from './support-actions';

type Message = { id: string; authorName: string; body: string; createdAt: string };
type Item = {
  id: string;
  orgName: string;
  category: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
  createdByName: string;
  messages: Message[];
};

const STATUS_OPTIONS = ['open', 'in_progress', 'waiting_on_org', 'resolved', 'closed'];

function Row({ item }: { item: Item }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  function handleStatus(status: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateSupportRequestStatus(item.id, status);
      if (result?.error) setError(result.error);
    });
  }

  function handleReply() {
    setError(null);
    startTransition(async () => {
      const result = await platformReplySupportRequest(item.id, reply);
      if (result?.error) setError(result.error);
      else setReply('');
    });
  }

  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }} onClick={() => setExpanded((v) => !v)}>
        <div className="list-row-main">
          <div className="list-row-title">{item.subject}</div>
          <div className="list-row-meta">
            {item.orgName} · {item.createdByName} · {item.category.replace('_', ' ')} · {new Date(item.createdAt).toLocaleDateString()}
          </div>
        </div>
        <select
          value={item.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleStatus(e.target.value)}
          disabled={pending}
          style={{ fontSize: 11.5, height: 'fit-content' }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {expanded && (
        <div style={{ paddingLeft: 4 }}>
          <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{item.body}</p>
          {item.messages.map((m) => (
            <div key={m.id} style={{ marginTop: 8, borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{m.authorName} · {new Date(m.createdAt).toLocaleString()}</div>
              <p style={{ fontSize: 13, margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>{m.body}</p>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the org…" style={{ flex: 1, fontSize: 12.5 }} />
            <button className="btn" disabled={pending || !reply.trim()} onClick={handleReply}>
              {pending ? 'Sending…' : 'Reply'}
            </button>
          </div>
          {error && <p className="error-text" style={{ marginTop: 6 }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function SupportQueue({ items }: { items: Item[] }) {
  return (
    <div className="card">
      {items.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No support requests yet.</p>}
      {items.map((item) => <Row key={item.id} item={item} />)}
    </div>
  );
}
