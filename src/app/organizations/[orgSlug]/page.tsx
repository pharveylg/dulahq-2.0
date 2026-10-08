import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function OrganizationStatusPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/organizations/${orgSlug}`);

  const { data: org } = await supabase.from('organizations').select('id, name, slug, created_at').eq('slug', orgSlug).maybeSingle();
  if (!org) notFound();

  // RLS already scopes every query below to a real member -- a non-member sees
  // empty results rather than another org's shell deadline or entitlements.
  const [{ data: shell }, { data: entitlements }, { count: memberCount }] = await Promise.all([
    supabase.from('org_onboarding_shells').select('expires_at').eq('org_id', org.id).maybeSingle(),
    supabase.from('org_entitlements').select('product, status').eq('org_id', org.id),
    supabase.from('org_members').select('org_id', { count: 'exact', head: true }).eq('org_id', org.id),
  ]);

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
            {entitlements!.map((e) => (
              <div key={e.product} style={{ fontSize: 13.5 }}>
                {e.product === 'club' ? 'Club' : 'Tournament'} — {e.status}
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <div className="section-label">Try every role first</div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            See what each role can do before you commit to a product.
          </p>
          <Link href="/demo" className="btn">Open Test Roles</Link>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 16 }}>
          Starting a club or tournament trial isn&apos;t available yet — that&apos;s next.
        </p>
      </div>
    </main>
  );
}
