import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, isPlatformAdmin } from '@/lib/supabase/server';
import Directory from './Directory';
import ProvisionForm from './ProvisionForm';
import SupportQueue from './SupportQueue';
import BillingConsole from './BillingConsole';
import Troubleshoot from './Troubleshoot';
import Listings, { type ListingRow } from './Listings';
import ProvisionLoginPanel from '@/components/ProvisionLoginPanel';

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
  const activeTab = tab === 'provision' ? 'provision' : tab === 'support' ? 'support' : tab === 'billing' ? 'billing' : tab === 'troubleshoot' ? 'troubleshoot' : tab === 'listings' ? 'listings' : tab === 'logins' ? 'logins' : 'directory';

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
      .select('id, org_id, category, subject, body, status, created_at, organizations(name, status, org_entitlements(product, status)), users!created_by(name, email)')
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
      // Same active/trial filter as the Directory (mirrors org_has_product) so
      // a ticket and the tenant list never disagree about what an org holds.
      entitlements: (r.organizations?.org_entitlements ?? [])
        .filter((e: any) => e.status === 'active' || e.status === 'trial')
        .map((e: any) => e.product as string),
      orgSuspended: r.organizations?.status === 'suspended',
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
  let billingUtilization: any[] = [];
  let billingInfraMetrics: any[] = [];
  let billingExpiredGraceOrgs: any[] = [];
  let listingRows: ListingRow[] = [];
  let loginRows: any[] = [];
  if (activeTab === 'logins') {
    const { data } = await supabase.from('provisioned_logins')
      .select('user_id, email, name, last_issued_at, temp_expires_at, activated_at, expired_at')
      .eq('scope_type', 'platform').order('last_issued_at', { ascending: false });
    loginRows = data ?? [];
  }

  if (activeTab === 'listings') {
    const [{ data: clubRows }, { data: tournamentRows }] = await Promise.all([
      supabase.from('clubs').select('id, name, publicly_listed, listing_blocked, listing_block_reason, organizations(name)').order('name'),
      supabase.from('tournaments').select('id, slug, name, poster_url, publicly_listed, listing_blocked, listing_block_reason, organizations(slug, name)').order('name'),
    ]);
    const map = (kind: 'club' | 'tournament') => (r: any): ListingRow => ({
      kind, id: r.id, name: r.name, org: r.organizations?.name ?? '', listed: r.publicly_listed, blocked: r.listing_blocked, reason: r.listing_block_reason,
      orgSlug: r.organizations?.slug, slug: r.slug, posterUrl: r.poster_url,
    });
    listingRows = [...(clubRows ?? []).map(map('club')), ...(tournamentRows ?? []).map(map('tournament'))];
  }

  if (activeTab === 'billing') {
    const db = supabase as any;
    const [{ data: invoiceRows }, { data: paymentRows }, { data: billingAccountRows }, { data: usageRows }, { data: subscriptionRows }, { data: meterRows }, { data: periodRows }, { data: planMeterRows }] = await Promise.all([
      db.from('billing_invoices').select('id, invoice_number, org_id, total, amount_paid, status, due_at, created_at, organizations(name)').eq('context_type', 'platform').order('created_at', { ascending: false }).limit(100),
      db.from('billing_payment_submissions').select('id, invoice_id, amount, method, reference_number, status, submitted_at, billing_invoices(invoice_number, organizations(name))').order('submitted_at', { ascending: false }).limit(100),
      db.from('billing_accounts').select('id, org_id, context_type, payment_instructions, qr_storage_key').eq('context_type', 'platform'),
      db.from('billing_usage_events').select('id, org_id, meter_key, quantity, context_type, source_type, occurred_at, organizations(name)').order('occurred_at', { ascending: false }).limit(100),
      db.from('billing_subscriptions').select('id, org_id, product, status, starts_at, renews_at, plan_id, billing_plans(name), organizations(name)').order('created_at', { ascending: false }).limit(200),
      db.from('billing_usage_meters').select('key, label, unit, product').eq('active', true).order('key'),
      // Utilization view (phase16e): the most recent snapshotted period per
      // org/meter, regardless of calendar month -- an org just past a
      // month boundary before the cron re-runs still shows its last real
      // numbers instead of going blank.
      db.from('billing_usage_periods').select('org_id, meter_key, quantity, period_start, period_end, organizations(name)').order('period_start', { ascending: false }),
      db.from('billing_plan_meters').select('plan_id, meter_key, included_quantity'),
    ]);
    const accountByOrg = new Map((billingAccountRows ?? []).map((row: any) => [row.org_id, row.id]));
    billingOrgs = (orgRows ?? []).map((org: any) => ({ id: org.id, name: org.name, billingAccountId: accountByOrg.get(org.id) ?? null }));
    billingAccounts = (billingAccountRows ?? []).map((row: any) => ({ id: row.id, orgName: (orgRows ?? []).find((org: any) => org.id === row.org_id)?.name ?? 'Unknown organization', instructions: row.payment_instructions, qrStorageKey: row.qr_storage_key }));
    billingInvoices = (invoiceRows ?? []).map((row: any) => ({ id: row.id, invoiceNumber: row.invoice_number, orgName: row.organizations?.name ?? 'Unknown organization', total: row.total, amountPaid: row.amount_paid, status: row.status, dueAt: row.due_at, createdAt: row.created_at }));
    billingPayments = (paymentRows ?? []).map((row: any) => ({ id: row.id, invoiceNumber: row.billing_invoices?.invoice_number ?? 'Unknown invoice', orgName: row.billing_invoices?.organizations?.name ?? 'Unknown organization', amount: row.amount, method: row.method, reference: row.reference_number, status: row.status, submittedAt: row.submitted_at }));
    billingUsageEvents = (usageRows ?? []).map((row: any) => ({ id: String(row.id), orgName: row.organizations?.name ?? 'Unknown organization', meterKey: row.meter_key, quantity: Number(row.quantity), contextType: row.context_type, occurredAt: row.occurred_at, sourceType: row.source_type }));
    billingSubscriptions = (subscriptionRows ?? []).map((row: any) => ({ id: row.id, orgName: row.organizations?.name ?? 'Unknown organization', product: row.product, planName: row.billing_plans?.name ?? 'Unknown plan', status: row.status, startsAt: row.starts_at, renewsAt: row.renews_at }));

    // Utilization (phase16e): the latest snapshotted period per org/meter,
    // paired with that org's plan quota so "42 of 100 included" reads at a
    // glance -- this is the view that actually informs pricing, more so
    // than the raw event log below it. A meter tagged "shared" (staff
    // seats, teams) checks whichever product's plan the org holds, club
    // first; a club-only/tournament-only meter checks only its own.
    const orgPlanByProduct = new Map<string, Map<string, string>>();
    for (const sub of subscriptionRows ?? []) {
      if (!orgPlanByProduct.has(sub.org_id)) orgPlanByProduct.set(sub.org_id, new Map());
      if (sub.plan_id) orgPlanByProduct.get(sub.org_id)!.set(sub.product, sub.plan_id);
    }
    const includedByPlanMeter = new Map<string, number>();
    for (const pm of planMeterRows ?? []) includedByPlanMeter.set(`${pm.plan_id}:${pm.meter_key}`, Number(pm.included_quantity));
    const meterInfo = new Map<string, { label: string; unit: string; product: string }>(
      (meterRows ?? []).map((m: any) => [m.key, { label: m.label, unit: m.unit, product: m.product }])
    );

    const seenOrgMeter = new Set<string>(); // periodRows is ordered by period_start desc, so first hit per org+meter is the latest
    billingUtilization = [];
    for (const row of periodRows ?? []) {
      const dedupeKey = `${row.org_id}:${row.meter_key}`;
      if (seenOrgMeter.has(dedupeKey)) continue;
      seenOrgMeter.add(dedupeKey);
      const info = meterInfo.get(row.meter_key);
      if (!info) continue;
      const productsToCheck = info.product === 'shared' ? ['club', 'tournament'] : [info.product];
      let includedQuantity: number | null = null;
      for (const p of productsToCheck) {
        const planId = orgPlanByProduct.get(row.org_id)?.get(p);
        const inc = planId ? includedByPlanMeter.get(`${planId}:${row.meter_key}`) : undefined;
        if (inc != null) { includedQuantity = inc; break; }
      }
      billingUtilization.push({
        orgId: row.org_id,
        orgName: row.organizations?.name ?? 'Unknown organization',
        meterKey: row.meter_key,
        meterLabel: info.label,
        unit: info.unit,
        quantity: Number(row.quantity),
        includedQuantity,
        periodStart: row.period_start,
        periodEnd: row.period_end,
      });
    }
    billingUtilization.sort((a, b) => a.orgName.localeCompare(b.orgName) || a.meterLabel.localeCompare(b.meterLabel));

    // Infra cost visibility (phase16k): what running Dula HQ itself costs,
    // platform-wide -- a different concern from the org-facing utilization
    // above. Latest period per metric, same "most recent row wins" pattern.
    const { data: infraRows } = await db.from('platform_infra_metrics').select('metric_key, value, unit, period_start').order('period_start', { ascending: false });
    const seenMetric = new Set<string>();
    billingInfraMetrics = [];
    for (const row of infraRows ?? []) {
      if (seenMetric.has(row.metric_key)) continue;
      seenMetric.add(row.metric_key);
      billingInfraMetrics.push({ metricKey: row.metric_key, value: Number(row.value), unit: row.unit, periodStart: row.period_start });
    }

    // Phase 4 of docs/proposals/self-serve-org-onboarding.md: visibility only --
    // nothing is deleted automatically, this is how Platform Admin finds out an
    // org is actually eligible for the manual purge step.
    const { data: graceRows } = await db.rpc('orgs_past_grace_period');
    billingExpiredGraceOrgs = (graceRows ?? []).map((row: any) => ({
      orgId: row.org_id, orgName: row.org_name, orgSlug: row.org_slug, product: row.product, graceUntil: row.grace_until,
    }));
  }

  let activeSession = null;
  if (activeTab === 'troubleshoot') {
    const { data } = await supabase.rpc('my_active_platform_impersonation');
    activeSession = (data ?? [])[0] ?? null;
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

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
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
          <Link href="/platformconsole?tab=troubleshoot" className={activeTab === 'troubleshoot' ? 'btn btn-primary' : 'btn'}>
            Troubleshoot
          </Link>
          <Link href="/platformconsole?tab=listings" className={activeTab === 'listings' ? 'btn btn-primary' : 'btn'}>
            Listings
          </Link>
          <Link href="/platformconsole?tab=logins" className={activeTab === 'logins' ? 'btn btn-primary' : 'btn'}>
            Logins
          </Link>
        </div>

        {activeTab === 'directory' && <Directory orgs={orgs} />}
        {activeTab === 'provision' && <ProvisionForm />}
        {activeTab === 'support' && <SupportQueue items={supportItems} />}
        {activeTab === 'billing' && <BillingConsole invoices={billingInvoices} payments={billingPayments} orgs={billingOrgs} accounts={billingAccounts} usageEvents={billingUsageEvents} subscriptions={billingSubscriptions} utilization={billingUtilization} infraMetrics={billingInfraMetrics} expiredGraceOrgs={billingExpiredGraceOrgs} />}
        {activeTab === 'listings' && <Listings rows={listingRows} />}
        {activeTab === 'logins' && <ProvisionLoginPanel scope="platform" scopeId={null} logins={loginRows} allowReissueByEmail />}
        {activeTab === 'troubleshoot' && <Troubleshoot orgs={orgs} activeSession={activeSession} />}
      </div>
    </main>
  );
}
