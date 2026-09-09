import { createClient } from '@/lib/supabase/server';

/**
 * Club Admin spec §10 requirement 3: "The UI must display a highly visible
 * impersonation indicator." Rendered from the root layout so it follows the
 * admin onto every page for as long as the session is live, and disappears
 * on its own when it expires (the RPC filters on expires_at).
 *
 * Worth being precise about what it means: the admin is still signed in as
 * themselves and still acting with their own permissions. The banner marks
 * an open inspection session, not a change of identity.
 */
export default async function ImpersonationBanner() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_active_impersonation');
  const active = (data ?? [])[0];
  if (!active) return null;

  return (
    <div
      role="status"
      style={{
        background: 'var(--warn-soft)',
        borderBottom: '1px solid var(--warn-soft-border)',
        color: 'var(--warn)',
        padding: '8px 0',
        fontSize: 12.5,
        fontWeight: 600,
      }}
    >
      <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span>
          Inspecting access as <strong>{active.target_name ?? 'another user'}</strong> — you are still signed in as
          yourself and acting with your own permissions.
        </span>
        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
          Expires {new Date(active.expires_at).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
