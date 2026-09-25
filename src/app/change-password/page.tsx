'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changeTemporaryPassword } from './actions';
import { MIN_NEW_PASSWORD_LENGTH } from '@/lib/temp-password';

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await changeTemporaryPassword(password, confirm);
    if ('error' in result && result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 360 }}>
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h1>Choose your password</h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          You signed in with a temporary password. Choose one only you know before you continue.
          Use at least {MIN_NEW_PASSWORD_LENGTH} characters, mixing lowercase with capitals or numbers.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="new-password">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm new password</label>
            <input id="confirm-password" type="password" autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </div>
    </main>
  );
}
