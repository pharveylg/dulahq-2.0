import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { getCurrentDulaUser } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Dula HQ 2.0 — Club Manager',
  description: 'Club setup and staff management',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const dulaUser = authUser ? await getCurrentDulaUser() : null;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Oswald:wght@500;600;700&family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <nav className="top-nav">
          <div className="container">
            <Link href="/clubs" className="brand">
              Dula HQ <span className="accent">2.0</span>
            </Link>
            {authUser && (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {dulaUser?.name ?? authUser.email}
                {dulaUser?.role && (
                  <span className="chip" style={{ marginLeft: 8 }}>{dulaUser.role}</span>
                )}
              </span>
            )}
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
