import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { getCurrentDulaUser, claimPendingGuardianInvite } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import NavActions from './NavActions';
import RegisterServiceWorker from './RegisterServiceWorker';
import ThemeToggle, { ThemeInitScript } from './ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { getMyNotifications } from '@/lib/notifications-actions';

export const metadata: Metadata = {
  title: 'Dulà HQ — Club Manager',
  description: 'Club setup and staff management',
  // manifest.ts and icon.tsx/apple-icon.tsx are Next.js file conventions --
  // both auto-linked in <head>, nothing to wire up here.
};

export const viewport: Viewport = {
  themeColor: '#059669',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  let dulaUser = authUser ? await getCurrentDulaUser() : null;

  // Opportunistic guardian claim (RBAC Phase 3) -- only worth checking
  // when there's no public.users row yet, since a successful claim
  // creates one; every later request short-circuits here for free.
  if (authUser && !dulaUser) {
    await claimPendingGuardianInvite();
    dulaUser = await getCurrentDulaUser();
  }

  const initialNotifications = authUser ? await getMyNotifications() : [];

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Oswald:wght@500;600;700&family=JetBrains+Mono:wght@400;700&family=Noto+Sans+Tagalog&display=swap"
          rel="stylesheet"
        />
        <ThemeInitScript />
      </head>
      <body>
        <RegisterServiceWorker />
        <nav className="top-nav">
          <div className="container">
            <Link href="/" className="brand">
              <span className="baybayin">ᜇᜓᜎ</span>
              Dulà HQ
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {authUser && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {dulaUser?.name ?? authUser.email}
                  {dulaUser?.role && (
                    <span className="chip" style={{ marginLeft: 8 }}>{dulaUser.role}</span>
                  )}
                </span>
              )}
              {authUser && <NotificationBell initial={initialNotifications} />}
              <ThemeToggle />
              <NavActions signedIn={!!authUser} />
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
