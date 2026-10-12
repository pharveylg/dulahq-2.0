import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

/**
 * Phase 4 follow-up to docs/proposals/self-serve-org-onboarding.md: the
 * /organizations/[orgSlug] status page shows trial/grace state, but nobody
 * lands there once a club or tournament is actually in use -- this puts the
 * same state in front of whoever is already looking at the console it affects.
 *
 * org_entitlements' own read policy is `is_org_member(org_id)`, authenticated
 * only, no anon policy at all -- a guest on a public club page gets zero rows
 * back and this quietly renders nothing, the same guard the club layout's own
 * accent theming already relies on for the guest-vs-staff split.
 */
export default async function TrialStatusBanner({
  orgId,
  orgSlug,
  product,
}: {
  orgId: string;
  orgSlug: string;
  product: 'club' | 'tournament';
}) {
  const supabase = await createClient();
  const { data: entitlement } = await supabase
    .from('org_entitlements')
    .select('status, valid_until, grace_until')
    .eq('org_id', orgId)
    .eq('product', product)
    .maybeSingle();

  if (!entitlement || entitlement.status === 'active') return null;

  const productLabel = product === 'club' ? 'Club' : 'Tournament';
  const newThingLabel = product === 'club' ? 'clubs and teams' : 'tournaments and entries';

  if (entitlement.status === 'trial' && entitlement.valid_until) {
    const daysLeft = Math.ceil((new Date(entitlement.valid_until).getTime() - Date.now()) / 86_400_000);
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
        <div className="container">
          {productLabel} trial — {daysLeft > 0 ? `ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'ends today'} (
          {new Date(entitlement.valid_until).toLocaleDateString()}).{' '}
          <Link href={`/organizations/${orgSlug}`} style={{ color: 'inherit', textDecoration: 'underline' }}>
            Upgrade or pay now
          </Link>
        </div>
      </div>
    );
  }

  if (entitlement.status === 'suspended') {
    const pastGrace = !!entitlement.grace_until && new Date(entitlement.grace_until).getTime() < Date.now();
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
          {productLabel} trial expired — new {newThingLabel} are paused.{' '}
          {entitlement.grace_until &&
            (pastGrace
              ? 'Its read-only grace period has ended.'
              : `Existing data stays read-only until ${new Date(entitlement.grace_until).toLocaleDateString()}.`)}{' '}
          <Link href={`/organizations/${orgSlug}`} style={{ color: 'inherit', textDecoration: 'underline' }}>
            Pay now to reactivate
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
