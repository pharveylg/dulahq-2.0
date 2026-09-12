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
  const [{ data: clubSessions }, { data: platformSessions }] = await Promise.all([
    supabase.rpc('my_active_impersonation'),
    // Platform Admin's own cross-org tier (gap analysis 2026-09-11 §1.2) --
    // a separate RPC/table from the club-scoped one above, but the same
    // banner discipline applies: identity never changes, only the readout
    // this session unlocks does.
    (supabase as any).rpc('my_active_platform_impersonation'),
  ]);
  const active = (clubSessions ?? [])[0];
  const activePlatform = (platformSessions ?? [])[0];
  if (!active && !activePlatform) return null;

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
        {active && (
          <>
            <span>
              Inspecting access as <strong>{active.target_name ?? 'another user'}</strong> — you are still signed in as
              yourself and acting with your own permissions.
            </span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
              Expires {new Date(active.expires_at).toLocaleTimeString()}
            </span>
          </>
        )}
        {activePlatform && (
          <>
            <span>
              Platform troubleshooting: inspecting <strong>{activePlatform.target_name ?? 'another user'}</strong> in{' '}
              <strong>{activePlatform.org_name}</strong> — you are still signed in as yourself.
            </span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
              Expires {new Date(activePlatform.expires_at).toLocaleTimeString()}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
