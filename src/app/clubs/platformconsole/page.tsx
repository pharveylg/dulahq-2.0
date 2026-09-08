import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, isPlatformAdmin } from '@/lib/supabase/server';
import Directory from './Directory';
import ProvisionForm from './ProvisionForm';

export default async function PlatformConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (!(await isPlatformAdmin())) {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 420 }}>
          <div className="page-header"><h1>Platform console</h1></div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            Only a platform admin can access this.
          </p>
        </div>
      </main>
    );
  }

  const { tab } = await searchParams;
  const activeTab = tab === 'provision' ? 'provision' : 'directory';

  const { data: orgRows } = await supabase
    .from('organizations')
    .select('id, slug, name, accent, status, clubs(count), org_members(count), org_entitlements(product, status)')
    .order('created_at', { ascending: false });

  const orgs = (orgRows ?? []).map((o: any) => ({
    id: o.id,
    slug: o.slug,
    name: o.name,
    accent: o.accent,
    status: o.status,
    clubCount: o.clubs?.[0]?.count ?? 0,
    memberCount: o.org_members?.[0]?.count ?? 0,
    // Mirrors org_has_product()'s own gate -- a 'suspended'/'cancelled' row
    // still exists but shouldn't show as a granted product.
    entitlements: (o.org_entitlements ?? [])
      .filter((e: any) => e.status === 'active' || e.status === 'trial')
      .map((e: any) => e.product as string),
  }));

  return (
    <main className="page">
      <div className="container">
        <Link href="/clubs" className="back-link">← Clubs</Link>

        <div className="page-header">
          <div>
            <h1>Platform console</h1>
            <p className="subtitle">Tenant directory &amp; provisioning</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Link href="/clubs/platformconsole?tab=directory" className={activeTab === 'directory' ? 'btn btn-primary' : 'btn'}>
            Tenant directory
          </Link>
          <Link href="/clubs/platformconsole?tab=provision" className={activeTab === 'provision' ? 'btn btn-primary' : 'btn'}>
            Provisioning
          </Link>
        </div>

        {activeTab === 'directory' ? <Directory orgs={orgs} /> : <ProvisionForm />}
      </div>
    </main>
  );
}
