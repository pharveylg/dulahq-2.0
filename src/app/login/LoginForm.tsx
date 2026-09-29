'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Reveal from '@/components/motion/Reveal';
import Spotlight from '@/components/motion/Spotlight';
import PosterWatermark from '@/components/PosterWatermark';

function LoginFields({ posterUrl, destination }: { posterUrl: string | null; destination: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function doSignIn(signInEmail: string, signInPassword: string) {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: signInEmail, password: signInPassword });

    if (error) {
      setError(
        /banned/i.test(error.message)
          ? 'This temporary password has expired. Ask your IT admin to issue a new one.'
          : error.message,
      );
      setLoading(false);
      return;
    }

    // Only honor a same-origin relative path -- redirectTo comes from a
    // URL query param (set by middleware.ts when it gates a direct link
    // to a protected page), so a crafted "//evil.com" or "https://evil.com"
    // value must never be followed.
    const redirectTo = searchParams.get('redirectTo');
    const target = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/';
    router.push(target);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await doSignIn(email, password);
  }

  return (
    <main className="page" style={{ position: 'relative', overflow: 'hidden' }}>
      <PosterWatermark url={posterUrl} />
      <Spotlight />
      <div className="container" style={{ maxWidth: 360, position: 'relative' }}>
        <Reveal>
          <div className="page-header" style={{ marginBottom: 24 }}>
            <h1>Sign in</h1>
            {destination && (
              <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                to continue to {destination}
              </p>
            )}
          </div>
        </Reveal>
        <Reveal index={1}>
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </Reveal>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16 }}>
          This app doesn't create staff accounts — sign in with an existing
          Dula HQ login. Staff accounts are still managed the same way the
          rest of the app already handles them.
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
          Invited as a guardian? <Link href="/guardian-signup">Create your account</Link>.
        </p>
      </div>
    </main>
  );
}

/**
 * useSearchParams() needs a Suspense boundary; the parent server component (page.tsx)
 * already resolved which tournament (if any) this sign-in is for and passes its poster
 * and a plain-English destination label down as props, so that lookup itself doesn't
 * need to happen client-side.
 */
export default function LoginForm({
  posterUrl,
  destination,
}: {
  posterUrl: string | null;
  destination: string | null;
}) {
  return (
    <Suspense fallback={null}>
      <LoginFields posterUrl={posterUrl} destination={destination} />
    </Suspense>
  );
}
