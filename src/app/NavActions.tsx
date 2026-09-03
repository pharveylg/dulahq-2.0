'use client';

import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function NavActions({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const showBack = pathname !== '/' && pathname !== '/login';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {showBack && (
        <button
          type="button"
          onClick={() => router.back()}
          className="btn"
          style={{ fontSize: 12, padding: '5px 10px' }}
        >
          ← Back
        </button>
      )}
      {signedIn && (
        <button
          type="button"
          onClick={handleLogout}
          className="btn"
          style={{ fontSize: 12, padding: '5px 10px' }}
        >
          Log out
        </button>
      )}
    </div>
  );
}
