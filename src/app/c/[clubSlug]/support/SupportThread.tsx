'use client';

import { useState, useTransition } from 'react';
import { replySupportRequest } from './actions';

type Message = { id: string; authorName: string; body: string; createdAt: string };
type Item = {
  id: string;
  category: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
  createdByName: string;
  isMine: boolean;
  messages: Message[];
};

const STATUS_TONE: Record<string, React.CSSProperties> = {
  open: { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' },
  in_progress: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' },
  waiting_on_org: { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' },
  resolved: {},
  closed: { color: 'var(--text-muted)' },
};

export default function SupportThread({ item }: { item: Item }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  function handleReply() {
    setError(null);
    startTransition(async () => {
      const result = await replySupportRequest(item.id, reply);
      if (result?.error) setError(result.error);
      else setReply('');
    });
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="list-row-main">
          <div className="list-row-title">{item.subject}</div>
          <div className="list-row-meta">
            {item.createdByName} · {new Date(item.createdAt).toLocaleDateString()}
            {item.messages.length > 0 ? ` · ${item.messages.length} repl${item.messages.length === 1 ? 'y' : 'ies'}` : ''}
          </div>
        </div>
        <span className="chip" style={STATUS_TONE[item.status]}>{item.status.replace('_', ' ')}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{item.body}</p>

          {item.messages.length > 0 && (
            <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: 12, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {item.messages.map((m) => (
                <div key={m.id}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {m.authorName} · {new Date(m.createdAt).toLocaleString()}
                  </div>
                  <p style={{ fontSize: 13, margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>{m.body}</p>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Add a reply…"
              style={{ flex: 1, fontSize: 12.5 }}
            />
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
