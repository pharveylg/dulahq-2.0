import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import StartTrialForm from './StartTrialForm';
import PayNowButton from './PayNowButton';

export default async function OrganizationStatusPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/organizations/${orgSlug}`);

  const { data: org } = await supabase.from('organizations').select('id, name, slug, created_at').eq('slug', orgSlug).maybeSingle();
  if (!org) notFound();

  // RLS already scopes every query below to a real member -- a non-member sees
  // empty results rather than another org's shell deadline or entitlements.
  const [{ data: shell }, { data: entitlements }, { count: memberCount }, { data: trialPolicy }, { data: trialCaps }] = await Promise.all([
    supabase.from('org_onboarding_shells').select('expires_at').eq('org_id', org.id).maybeSingle(),
    supabase.from('org_entitlements').select('product, status, valid_until, grace_until').eq('org_id', org.id),
    supabase.from('org_members').select('org_id', { count: 'exact', head: true }).eq('org_id', org.id),
    supabase.from('trial_policy').select('trial_days').eq('id', true).maybeSingle(),
    supabase.from('trial_caps').select('product, limit_key, limit_value'),
  ]);
  const { data: plans } = await supabase.from('billing_plans').select('product, currency, base_amount').eq('version', 1).in('plan_key', ['club-basic', 'tournament-basic']);
  const priceLabel = (product: string) => {
    const plan = plans?.find((p) => p.product === product);
    if (!plan) return '';
    return plan.base_amount === 0 ? 'free' : `${plan.currency} ${plan.base_amount}/mo`;
  };

  if ((memberCount ?? 0) === 0) {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 480 }}>
          <div className="page-header"><h1>Not found</h1></div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            This organization isn&apos;t visible to you.
          </p>
        </div>
      </main>
    );
  }

  const hasProduct = (entitlements?.length ?? 0) > 0;
  const capValue = (product: string, key: string) => trialCaps?.find((c) => c.product === product && c.limit_key === key)?.limit_value ?? 0;
  const missingProducts = (['club', 'tournament'] as const).filter((p) => !entitlements?.some((e) => e.product === p));

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="page-header">
          <h1>{org.name}</h1>
        </div>

        {shell && !hasProduct && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-label">Setup shell</div>
            <p style={{ fontSize: 13.5 }}>
              No club or tournament yet. If nothing is selected by{' '}
              <strong>{new Date(shell.expires_at).toLocaleString()}</strong>, this
              organization is removed automatically.
            </p>
          </div>
        )}

        {hasProduct && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-label">Products</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {entitlements!.map((e) => (
                <div key={e.product} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13.5 }}>
                  <span>
                    {e.product === 'club' ? 'Club' : 'Tournament'} — {e.status === 'suspended' ? 'trial expired' : e.status}
                    {e.status === 'trial' && e.valid_until && (
                      <span style={{ color: 'var(--text-muted)' }}> · ends {new Date(e.valid_until).toLocaleDateString()}</span>
                    )}
                    {e.status === 'suspended' && e.grace_until && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        {' '}· new {e.product === 'club' ? 'clubs/teams' : 'tournaments/entries'} are paused · data stays
                        available read-only until {new Date(e.grace_until).toLocaleDateString()}
                      </span>
                    )}
                  </span>
                  {e.status !== 'active' && (
                    <PayNowButton orgId={org.id} product={e.product as 'club' | 'tournament'} price={priceLabel(e.product)} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {missingProducts.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-label">Start a free trial</div>
            <StartTrialForm
              orgId={org.id}
              trialDays={trialPolicy?.trial_days ?? 14}
              products={missingProducts}
              caps={{
                club: { clubs: capValue('club', 'clubs_per_org'), teams: capValue('club', 'teams_per_club') },
                tournament: { tournaments: capValue('tournament', 'tournaments_per_org'), entries: capValue('tournament', 'entries_per_tournament') },
              }}
            />
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              {missingProducts.map((p) => (
                <div key={p} style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Or skip the trial for {p === 'club' ? 'Club' : 'Tournament'}:{' '}
                  <PayNowButton orgId={org.id} product={p} price={priceLabel(p)} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="section-label">Try every role first</div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            See what each role can do before you commit to a product.
          </p>
          <Link href="/demo" className="btn">Open Test Roles</Link>
        </div>

        {hasProduct && (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16 }}>
            Open your club or tournament from <Link href="/clubs">Clubs</Link> or{' '}
            <Link href="/tournaments">Tournaments</Link>.
          </p>
        )}
      </div>
    </main>
  );
}
