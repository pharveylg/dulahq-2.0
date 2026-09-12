import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, isPlatformAdmin } from '@/lib/supabase/server';
import Directory from './Directory';
import ProvisionForm from './ProvisionForm';
import SupportQueue from './SupportQueue';
import BillingConsole from './BillingConsole';

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
  const activeTab = tab === 'provision' ? 'provision' : tab === 'support' ? 'support' : tab === 'billing' ? 'billing' : 'directory';

  const { count: openSupportCount } = await supabase
    .from('support_requests')
    .select('id', { count: 'exact', head: true })
    .not('status', 'in', '("resolved","closed")');

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

  // P1-10 (gap analysis §12). is_platform_admin() is one of users_read_
  // self_and_org's own OR branches, so unlike the club-side directory fix
  // this can join directly -- no self-row-only trap here.
  let supportItems: any[] = [];
  if (activeTab === 'support') {
    const { data: requests, error: requestsError } = await supabase
      .from('support_requests')
      .select('id, org_id, category, subject, body, status, created_at, organizations(name), users!created_by(name, email)')
      .order('created_at', { ascending: false });
    // Silently swallowing this once already hid a real bug: created_by
    // pointed at auth.users, which PostgREST can't embed, so `requests`
    // came back empty with no visible error at all (phase7f fixed the FK;
    // this stays so the same failure mode can't hide again).
    if (requestsError) console.error('platformconsole support tab: failed to load requests', requestsError);

    const requestIds = (requests ?? []).map((r) => r.id);
    const { data: messageRows } = requestIds.length
      ? await supabase
          .from('support_request_messages')
          .select('id, request_id, body, created_at, users!author_user_id(name, email)')
          .in('request_id', requestIds)
          .order('created_at')
      : { data: [] };

    const messagesByRequest = new Map<string, any[]>();
    for (const m of messageRows ?? []) {
      const list = messagesByRequest.get(m.request_id) ?? [];
      list.push({ id: m.id, authorName: (m as any).users?.name ?? (m as any).users?.email ?? 'Unknown', body: m.body, createdAt: m.created_at });
      messagesByRequest.set(m.request_id, list);
    }

    supportItems = (requests ?? []).map((r: any) => ({
      id: r.id,
      orgName: r.organizations?.name ?? 'Unknown org',
      category: r.category,
      subject: r.subject,
      body: r.body,
      status: r.status,
      createdAt: r.created_at,
      createdByName: r.users?.name ?? r.users?.email ?? 'Unknown',
      messages: messagesByRequest.get(r.id) ?? [],
    }));
  }

  let billingInvoices: any[] = [];
  let billingPayments: any[] = [];
  let billingOrgs: any[] = [];
  let billingAccounts: any[] = [];
  let billingUsageEvents: any[] = [];
  let billingSubscriptions: any[] = [];
  if (activeTab === 'billing') {
    const db = supabase as any;
    const [{ data: invoiceRows }, { data: paymentRows }, { data: billingAccountRows }, { data: usageRows }, { data: subscriptionRows }] = await Promise.all([
      db.from('billing_invoices').select('id, invoice_number, org_id, total, amount_paid, status, due_at, created_at, organizations(name)').eq('context_type', 'platform').order('created_at', { ascending: false }).limit(100),
      db.from('billing_payment_submissions').select('id, invoice_id, amount, method, reference_number, status, submitted_at, billing_invoices(invoice_number, organizations(name))').order('submitted_at', { ascending: false }).limit(100),
      db.from('billing_accounts').select('id, org_id, context_type, payment_instructions, qr_storage_key').eq('context_type', 'platform'),
      db.from('billing_usage_events').select('id, org_id, meter_key, quantity, context_type, source_type, occurred_at, organizations(name)').order('occurred_at', { ascending: false }).limit(100),
      db.from('billing_subscriptions').select('id, org_id, product, status, starts_at, renews_at, billing_plans(name), organizations(name)').order('created_at', { ascending: false }).limit(200),
    ]);
    const accountByOrg = new Map((billingAccountRows ?? []).map((row: any) => [row.org_id, row.id]));
    billingOrgs = (orgRows ?? []).map((org: any) => ({ id: org.id, name: org.name, billingAccountId: accountByOrg.get(org.id) ?? null }));
    billingAccounts = (billingAccountRows ?? []).map((row: any) => ({ id: row.id, orgName: (orgRows ?? []).find((org: any) => org.id === row.org_id)?.name ?? 'Unknown organization', instructions: row.payment_instructions, qrStorageKey: row.qr_storage_key }));
    billingInvoices = (invoiceRows ?? []).map((row: any) => ({ id: row.id, invoiceNumber: row.invoice_number, orgName: row.organizations?.name ?? 'Unknown organization', total: row.total, amountPaid: row.amount_paid, status: row.status, dueAt: row.due_at, createdAt: row.created_at }));
    billingPayments = (paymentRows ?? []).map((row: any) => ({ id: row.id, invoiceNumber: row.billing_invoices?.invoice_number ?? 'Unknown invoice', orgName: row.billing_invoices?.organizations?.name ?? 'Unknown organization', amount: row.amount, method: row.method, reference: row.reference_number, status: row.status, submittedAt: row.submitted_at }));
    billingUsageEvents = (usageRows ?? []).map((row: any) => ({ id: String(row.id), orgName: row.organizations?.name ?? 'Unknown organization', meterKey: row.meter_key, quantity: Number(row.quantity), contextType: row.context_type, occurredAt: row.occurred_at, sourceType: row.source_type }));
    billingSubscriptions = (subscriptionRows ?? []).map((row: any) => ({ id: row.id, orgName: row.organizations?.name ?? 'Unknown organization', product: row.product, planName: row.billing_plans?.name ?? 'Unknown plan', status: row.status, startsAt: row.starts_at, renewsAt: row.renews_at }));
  }

  return (
    <main className="page">
      <div className="container">
        <Link href="/" className="back-link">← Home</Link>

        <div className="page-header">
          <div>
            <h1>Platform console</h1>
            <p className="subtitle">Tenant directory &amp; provisioning</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Link href="/platformconsole?tab=directory" className={activeTab === 'directory' ? 'btn btn-primary' : 'btn'}>
            Tenant directory
          </Link>
          <Link href="/platformconsole?tab=provision" className={activeTab === 'provision' ? 'btn btn-primary' : 'btn'}>
            Provisioning
          </Link>
          <Link href="/platformconsole?tab=support" className={activeTab === 'support' ? 'btn btn-primary' : 'btn'}>
            Support{openSupportCount ? ` (${openSupportCount})` : ''}
          </Link>
          <Link href="/platformconsole?tab=billing" className={activeTab === 'billing' ? 'btn btn-primary' : 'btn'}>
            Billing
          </Link>
        </div>

        {activeTab === 'directory' && <Directory orgs={orgs} />}
        {activeTab === 'provision' && <ProvisionForm />}
        {activeTab === 'support' && <SupportQueue items={supportItems} />}
        {activeTab === 'billing' && <BillingConsole invoices={billingInvoices} payments={billingPayments} orgs={billingOrgs} accounts={billingAccounts} usageEvents={billingUsageEvents} subscriptions={billingSubscriptions} />}
      </div>
    </main>
  );
}
