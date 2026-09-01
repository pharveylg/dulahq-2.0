'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function GuardianSignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      // Email confirmation isn't required for this project -- claim the
      // invite right away (the root layout does this automatically on
      // next page load, but redirecting straight to /clubs feels better
      // than a blank intermediate step).
      router.push('/clubs');
      router.refresh();
      return;
    }

    // Confirmation required -- the root layout completes the claim the
    // next time they load any page with a confirmed session.
    setCheckEmail(true);
    setLoading(false);
  }

  if (checkEmail) {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 360 }}>
          <div className="page-header" style={{ marginBottom: 24 }}>
            <h1>Check your email</h1>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            We sent a confirmation link to <b style={{ color: 'var(--text)' }}>{email}</b>. Click it, then come back
            here — your account will be linked to your invite automatically.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 360 }}>
        <div className="page-header" style={{ marginBottom: 24 }}>
          <h1>Create your account</h1>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16 }}>
          Use the email your club invited — this only works if a club has already added you as a
          guardian and invited you. Already have an account? <Link href="/login">Sign in</Link>.
        </p>
      </div>
    </main>
  );
}
