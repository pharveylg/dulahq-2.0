import { createClient } from '@/lib/supabase/server';

/**
 * Once an org is suspended (phase9a) every RLS policy and permission helper
 * refuses its members, so the app just goes empty. Without this a coach would
 * see blank pages and have no way to tell "we were suspended" from "it's
 * broken". Platform admins are excluded server-side by the RPC itself.
 */
export default async function SuspendedOrgBanner() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_suspended_orgs');
  const orgs = data ?? [];
  if (orgs.length === 0) return null;

  return (
    <div
      role="alert"
      style={{
        background: 'var(--danger-soft)',
        borderBottom: '1px solid var(--danger-soft-border)',
        color: 'var(--danger)',
        padding: '8px 0',
        fontSize: 12.5,
        fontWeight: 600,
      }}
    >
      <div className="container">
        {orgs.map((o) => o.org_name).join(', ')} {orgs.length === 1 ? 'is' : 'are'} suspended — access is paused for
        everyone in the organization. Contact Dulà HQ support to have it restored.
      </div>
    </div>
  );
}
