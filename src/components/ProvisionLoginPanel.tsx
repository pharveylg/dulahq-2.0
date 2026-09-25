'use client';

import { useState, useTransition } from 'react';
import { provisionLogin, reissueLogin, reissueLoginByEmail } from '@/app/logins-actions';
import { formatForReading } from '@/lib/temp-password';

export type IssuedLogin = {
  user_id: string;
  email: string;
  name: string | null;
  last_issued_at: string;
  temp_expires_at: string;
  activated_at: string | null;
  expired_at: string | null;
};

type Issued = { email: string; name: string; password: string; hours: number };

function statusOf(l: IssuedLogin) {
  if (l.activated_at) return { label: 'signed in', warn: false };
  if (l.expired_at || new Date(l.temp_expires_at) < new Date()) return { label: 'expired', warn: true };
  return { label: 'waiting for first sign-in', warn: false };
}

/**
 * Create a login with a one-time temporary password, and reissue for logins this
 * scope created. The password is shown here once and never stored; closing the
 * notice loses it (reissue makes a new one).
 */
export default function ProvisionLoginPanel({
  scope,
  scopeId,
  logins,
  allowReissueByEmail = false,
}: {
  scope: 'club' | 'tournament' | 'platform';
  scopeId: string | null;
  logins: IssuedLogin[];
  allowReissueByEmail?: boolean;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState('');
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function show(r: any) {
    if (r?.error) { setError(r.error); return; }
    setIssued({ email: r.email, name: r.name, password: r.password, hours: r.hours });
    setCopied(false);
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await provisionLogin(scope, scopeId, name, email);
      show(r);
      if (!('error' in r)) { setName(''); setEmail(''); }
    });
  }

  function reissue(l: IssuedLogin) {
    if (!window.confirm(`Issue a new temporary password for ${l.email}? Their current password stops working.`)) return;
    setError(null);
    startTransition(async () => show(await reissueLogin(scope, scopeId, l.user_id)));
  }

  function reissueByEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm(`Issue a new temporary password for ${lookup}? Their current password stops working.`)) return;
    setError(null);
    startTransition(async () => { show(await reissueLoginByEmail(lookup)); });
  }

  async function copy() {
    if (!issued) return;
    try { await navigator.clipboard.writeText(issued.password); setCopied(true); } catch { /* selecting by hand still works */ }
  }

  return (
    <div className="card">
      <form onSubmit={create} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0, flex: '1 1 160px' }}>
          <label htmlFor="login-name">Name</label>
          <input id="login-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Working…' : 'Create login'}
        </button>
      </form>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>
        You get a temporary password to hand over yourself. They must choose their own password on first sign-in,
        and the temporary one stops working after 72 hours if they never use it. No email is sent.
      </p>

      {error && <p className="error-text" role="alert" style={{ marginTop: 8 }}>{error}</p>}

      {issued && (
        <div role="status" style={{ marginTop: 12, padding: 12, border: '1px solid var(--warn-soft-border)', background: 'var(--warn-soft)', borderRadius: 6 }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            Temporary password for <strong>{issued.name || issued.email}</strong> ({issued.email}) — shown once, valid {issued.hours} hours:
          </div>
          <code style={{ fontSize: 20, letterSpacing: 1, userSelect: 'all' }} data-testid="temp-password">
            {formatForReading(issued.password)}
          </code>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            <button type="button" className="btn" onClick={() => setIssued(null)}>Done — I’ve passed it on</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>
            The dashes are for reading aloud — type it without them. Pass it on directly, not in a group chat.
          </p>
        </div>
      )}

      {allowReissueByEmail && (
        <form onSubmit={reissueByEmail} style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, flex: '1 1 240px' }}>
            <label htmlFor="reissue-email">Reset any account’s password</label>
            <input id="reissue-email" type="email" placeholder="email of the account" value={lookup} onChange={(e) => setLookup(e.target.value)} required />
          </div>
          <button type="submit" className="btn" disabled={pending}>Issue temporary password</button>
        </form>
      )}

      <div style={{ marginTop: 16 }}>
        {logins.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No logins created here yet.</p>}
        {logins.map((l) => {
          const s = statusOf(l);
          return (
            <div key={l.user_id} className="list-row">
              <div className="list-row-main">
                <div className="list-row-title">{l.name ?? l.email}</div>
                <div className="list-row-meta">{l.email} · issued {new Date(l.last_issued_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="chip" style={s.warn ? { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' } : undefined}>{s.label}</span>
                <button className="btn" style={{ fontSize: 11.5 }} disabled={pending} onClick={() => reissue(l)}>Reissue</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
