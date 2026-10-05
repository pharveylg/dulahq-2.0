'use client';

import BillingQrField from './BillingQrField';
import { useState, useTransition } from 'react';
import { createPlatformInvoice, reviewPlatformPayment, updatePlatformPaymentInstructions } from './billing-actions';
import { formatMoney, paymentStatusLabel } from '@/lib/billing';

type Invoice = {
  id: string;
  invoiceNumber: string;
  orgName: string;
  total: number;
  amountPaid: number;
  status: string;
  dueAt: string | null;
  createdAt: string;
};

type Payment = {
  id: string;
  invoiceNumber: string;
  orgName: string;
  amount: number;
  method: string;
  reference: string | null;
  status: string;
  submittedAt: string;
};

type Org = { id: string; name: string; billingAccountId: string | null };
type BillingAccount = { id: string; orgName: string; instructions: string | null; qrStorageKey: string | null };
type UsageEvent = { id: string; orgName: string; meterKey: string; quantity: number; contextType: string; occurredAt: string; sourceType: string | null };
type Subscription = { id: string; orgName: string; product: string; planName: string; status: string; startsAt: string; renewsAt: string | null };
type Utilization = {
  orgId: string;
  orgName: string;
  meterKey: string;
  meterLabel: string;
  unit: string;
  quantity: number;
  includedQuantity: number | null;
  periodStart: string;
  periodEnd: string;
};
type InfraMetric = { metricKey: string; value: number; unit: string; periodStart: string };

// Reference points for "how close to a real cost" -- not billed limits inside this
// app, just the known, stable, publicly-published free-tier ceilings for the infra
// this app actually runs on (Supabase project is on the free tier per CLAUDE.md §8;
// R2's free allowance is flat and doesn't depend on a plan). Crossing one of these
// is the actual cost-implication signal on a project that isn't paying for any of
// this yet -- a dollar estimate would be more precise once Supabase is on a paid
// plan, but guessing a plan tier here would be more misleading than useful.
const INFRA_REFERENCE: Record<string, { limit: number; label: string; note: string }> = {
  supabase_db_size_gb: { limit: 0.5, label: 'Supabase database', note: 'Free tier cap' },
  supabase_storage_gb: { limit: 1, label: 'Supabase file storage', note: 'Free tier cap' },
  supabase_auth_mau: { limit: 50000, label: 'Supabase monthly active users', note: 'Free tier cap' },
  r2_storage_gb: { limit: 10, label: 'Cloudflare R2 storage', note: 'Always-free allowance, any plan' },
  resend_emails_month: { limit: 3000, label: 'Transactional email (Resend)', note: 'Free tier cap per month; also 100 a day' },
};
const R2_OVERAGE_USD_PER_GB = 0.015; // Cloudflare's own published flat rate, not plan-dependent

function Status({ value }: { value: string }) {
  return <span className="chip">{paymentStatusLabel(value)}</span>;
}

export default function BillingConsole({ invoices, payments, orgs, accounts, usageEvents, subscriptions, utilization, infraMetrics }: { invoices: Invoice[]; payments: Payment[]; orgs: Org[]; accounts: BillingAccount[]; usageEvents: UsageEvent[]; subscriptions: Subscription[]; utilization: Utilization[]; infraMetrics: InfraMetric[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function createInvoice(formData: FormData) {
    setError(null); setSuccess(null);
    startTransition(async () => {
      const result = await createPlatformInvoice(formData);
      if (result?.error) setError(result.error);
      else setSuccess('Draft platform invoice created.');
    });
  }

  function updateInstructions(accountId: string, formData: FormData) {
    setError(null); setSuccess(null);
    startTransition(async () => {
      const result = await updatePlatformPaymentInstructions(accountId, formData);
      if (result?.error) setError(result.error);
      else setSuccess('Payment instructions saved.');
    });
  }

  const utilizationByOrg = new Map<string, { orgName: string; rows: Utilization[] }>();
  for (const u of utilization) {
    if (!utilizationByOrg.has(u.orgId)) utilizationByOrg.set(u.orgId, { orgName: u.orgName, rows: [] });
    utilizationByOrg.get(u.orgId)!.rows.push(u);
  }

  function review(id: string, status: 'verified' | 'rejected') {
    setError(null); setSuccess(null);
    const note = window.prompt(status === 'verified' ? 'Verification note (optional)' : 'Reason for rejection');
    if (status === 'rejected' && !note?.trim()) return;
    startTransition(async () => {
      const result = await reviewPlatformPayment(id, status, note ?? '');
      if (result?.error) setError(result.error);
      else setSuccess(`Payment ${status}.`);
    });
  }

  const infraByKey = new Map(infraMetrics.map((m) => [m.metricKey, m]));
  const infraPeriod = infraMetrics[0]?.periodStart;
  const r2Metric = infraByKey.get('r2_storage_gb');
  const r2OverageGb = r2Metric ? Math.max(0, r2Metric.value - INFRA_REFERENCE.r2_storage_gb.limit) : 0;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <div className="page-header" style={{ marginBottom: 10 }}>
          <div><h2 style={{ fontSize: 18 }}>Infrastructure costs</h2><p className="subtitle">What running Dula HQ itself costs, platform-wide — not billed to any organization</p></div>
        </div>
        {infraMetrics.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No infra snapshot yet — the monthly job records these on the 1st.</p>
        ) : (
          <>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8 }}>
              {infraPeriod && new Date(infraPeriod).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {Object.entries(INFRA_REFERENCE).map(([key, ref]) => {
                const metric = infraByKey.get(key);
                if (!metric) return null;
                const displayVal = metric.unit === 'GB' ? metric.value.toFixed(3) : Math.round(metric.value);
                const over = metric.value > ref.limit;
                const pct = Math.min(100, (metric.value / ref.limit) * 100);
                return (
                  <div key={key} style={{ fontSize: 12.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{ref.label}</span>
                      <span style={over ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>
                        {displayVal} {metric.unit} / {ref.limit} {metric.unit} ({ref.note})
                      </span>
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: over ? 'var(--danger)' : 'var(--accent)', borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {r2Metric && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
                {r2OverageGb > 0
                  ? `R2 storage is ${r2OverageGb.toFixed(2)} GB past its always-free allowance — roughly $${(r2OverageGb * R2_OVERAGE_USD_PER_GB).toFixed(2)}/month at Cloudflare's published rate.`
                  : 'R2 storage is within its always-free allowance — $0/month.'}
              </p>
            )}
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10, fontStyle: 'italic' }}>
              Vercel bandwidth and compute aren't tracked here — nothing in this app's own
              data can approximate them; seeing real numbers would need a separate
              connection to Vercel's own usage API.
            </p>
          </>
        )}
      </div>

      <div className="card">
        <div className="page-header" style={{ marginBottom: 10 }}>
          <div><h2 style={{ fontSize: 18 }}>Platform billing</h2><p className="subtitle">Simulation/manual QR mode — no payment provider connected</p></div>
          <span className="chip">Manual verification</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Create draft platform invoices for organizations, review usage-related charges, and verify payments submitted outside Dula HQ.
        </p>
        <form action={createInvoice} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <div className="form-row" style={{ flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label>Organization</label>
              <select name="orgId" required defaultValue=""><option value="" disabled>Select organization</option>{orgs.map((org) => <option key={org.id} value={org.id} disabled={!org.billingAccountId}>{org.name}{org.billingAccountId ? '' : ' — billing account pending'}</option>)}</select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label>Amount (PHP)</label><input name="amount" type="number" min="0.01" step="0.01" required />
            </div>
            <div className="form-group" style={{ flex: 2, minWidth: 220 }}>
              <label>Description</label><input name="description" placeholder="Club entitlement — September 2026" required />
            </div>
          </div>
          <div className="form-row" style={{ flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}><label>Due date</label><input name="dueAt" type="date" /></div>
            <div className="form-group" style={{ flex: 2, minWidth: 220 }}><label>Notes</label><input name="notes" placeholder="Optional billing note" /></div>
            <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create invoice'}</button>
          </div>
        </form>
        {(error || success) && <p className={error ? 'error-text' : undefined} style={!error ? { color: 'var(--accent)', fontSize: 13 } : undefined}>{error || success}</p>}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18 }}>Manual payment instructions</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>The written instructions and QR image payers see for each organization&apos;s manual payments.</p>
        {accounts.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No platform billing accounts yet.</p> : accounts.map((account) => (
          <form key={account.id} action={(fd) => updateInstructions(account.id, fd)} style={{ display: 'grid', gap: 8, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
            <strong style={{ fontSize: 13 }}>{account.orgName}</strong>
            <textarea name="paymentInstructions" rows={2} defaultValue={account.instructions ?? ''} placeholder="Example: Scan the Dula HQ QR code and include the invoice number in the payment note." />
            <BillingQrField accountId={account.id} canEdit={true} />
            <button className="btn" type="submit" disabled={pending} style={{ justifySelf: 'start' }}>{pending ? 'Saving…' : 'Save instructions'}</button>
          </form>
        ))}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18 }}>Subscriptions and entitlements</h2>
        {subscriptions.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No validation subscriptions yet.</p> : subscriptions.map((subscription) => <div key={subscription.id} className="list-row"><div className="list-row-main"><div className="list-row-title">{subscription.orgName} · {subscription.planName} <span className="chip">{subscription.status}</span></div><div className="list-row-meta">{subscription.product} · started {new Date(subscription.startsAt).toLocaleDateString()}{subscription.renewsAt ? ` · renews ${new Date(subscription.renewsAt).toLocaleDateString()}` : ''}</div></div></div>)}
      </div>

      <div className="card">
        <div className="page-header" style={{ marginBottom: 10 }}>
          <div><h2 style={{ fontSize: 18 }}>Usage & utilization</h2><p className="subtitle">Recorded automatically on the 1st of each month, against what each org's plan includes</p></div>
        </div>
        {utilizationByOrg.size === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No utilization snapshots yet — the monthly job records these on the 1st.</p>
        ) : (
          Array.from(utilizationByOrg.values()).map(({ orgName, rows }) => (
            <div key={orgName} style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
              <strong style={{ fontSize: 13.5 }}>{orgName}</strong>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8 }}>
                {/* periodStart is a date-only string ("2026-09-01"); Date parses that as
                    UTC midnight, so formatting it in the viewer's own local timezone can
                    roll it back a day (US timezones showed "August" for a September
                    period). timeZone: 'UTC' keeps the label matching the date the string
                    actually names. */}
                {new Date(rows[0].periodStart).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {rows.map((r) => {
                  const displayQty = r.unit === 'GB' ? r.quantity.toFixed(2) : Math.round(r.quantity);
                  const over = r.includedQuantity != null && r.quantity > r.includedQuantity;
                  const pct = r.includedQuantity ? Math.min(100, (r.quantity / r.includedQuantity) * 100) : null;
                  return (
                    <div key={r.meterKey} style={{ fontSize: 12.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span>{r.meterLabel}</span>
                        <span style={over ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>
                          {displayQty} {r.unit}{r.includedQuantity != null ? ` / ${r.includedQuantity} included` : ''}
                        </span>
                      </div>
                      {pct != null && (
                        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 3 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: over ? 'var(--danger)' : 'var(--accent)', borderRadius: 2 }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18 }}>Recent usage events</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Append-only usage facts used later for projected and period-locked billing.</p>
        {usageEvents.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No usage events recorded yet.</p> : usageEvents.map((event) => <div key={event.id} className="list-row"><div className="list-row-main"><div className="list-row-title">{event.meterKey} · {event.quantity}</div><div className="list-row-meta">{event.orgName} · {event.contextType} · {event.sourceType || 'system'} · {new Date(event.occurredAt).toLocaleString()}</div></div></div>)}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18 }}>Invoices</h2>
        {invoices.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No platform invoices yet.</p> : invoices.map((invoice) => <div key={invoice.id} className="list-row"><div className="list-row-main"><div className="list-row-title">{invoice.invoiceNumber} <Status value={invoice.status} /></div><div className="list-row-meta">{invoice.orgName} · {formatMoney(invoice.amountPaid)} paid of {formatMoney(invoice.total)}{invoice.dueAt ? ` · due ${new Date(invoice.dueAt).toLocaleDateString()}` : ''}</div></div></div>)}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18 }}>Payment submissions</h2>
        {payments.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No manual payment submissions yet.</p> : payments.map((payment) => <div key={payment.id} className="list-row"><div className="list-row-main"><div className="list-row-title">{payment.invoiceNumber} · {formatMoney(payment.amount)} <Status value={payment.status} /></div><div className="list-row-meta">{payment.orgName} · {payment.method} · {payment.reference || 'No reference'} · {new Date(payment.submittedAt).toLocaleString()}</div></div>{payment.status === 'submitted' || payment.status === 'under_review' ? <div style={{ display: 'flex', gap: 6 }}><button className="btn btn-primary" disabled={pending} onClick={() => review(payment.id, 'verified')}>Verify</button><button className="btn" disabled={pending} onClick={() => review(payment.id, 'rejected')}>Reject</button></div> : null}</div>)}
      </div>
    </div>
  );
}
