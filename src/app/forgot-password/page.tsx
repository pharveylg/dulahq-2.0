'use client';

import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from './actions';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await requestPasswordReset(email);
    setLoading(false);
    if ('error' in result && result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 360 }}>
          <div className="page-header" style={{ marginBottom: 16 }}>
            <h1>Check your email</h1>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            If an account exists for <b style={{ color: 'var(--text)' }}>{email}</b>, a reset link is
            on its way. It works once and expires soon.
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16 }}>
            <Link href="/login">Back to sign in</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 360 }}>
        <div className="page-header" style={{ marginBottom: 16 }}>
          <h1>Reset your password</h1>
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 16 }}>
          Enter the email on your Dulà HQ account and we’ll send a link to choose a new password.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16 }}>
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
