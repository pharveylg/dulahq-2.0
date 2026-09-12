'use client';

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

function Status({ value }: { value: string }) {
  return <span className="chip">{paymentStatusLabel(value)}</span>;
}

export default function BillingConsole({ invoices, payments, orgs, accounts, usageEvents, subscriptions }: { invoices: Invoice[]; payments: Payment[]; orgs: Org[]; accounts: BillingAccount[]; usageEvents: UsageEvent[]; subscriptions: Subscription[] }) {
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

  return (
    <div style={{ display: 'grid', gap: 16 }}>
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
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Configure the instructions shown to organizations while Dula HQ uses manual QR verification. QR image upload can be added through the existing file storage flow.</p>
        {accounts.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No platform billing accounts yet.</p> : accounts.map((account) => (
          <form key={account.id} action={(fd) => updateInstructions(account.id, fd)} style={{ display: 'grid', gap: 8, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
            <strong style={{ fontSize: 13 }}>{account.orgName}</strong>
            <textarea name="paymentInstructions" rows={2} defaultValue={account.instructions ?? ''} placeholder="Example: Scan the Dula HQ QR code and include the invoice number in the payment note." />
            <input name="qrStorageKey" defaultValue={account.qrStorageKey ?? ''} placeholder="Optional QR storage key" />
            <button className="btn" type="submit" disabled={pending} style={{ justifySelf: 'start' }}>{pending ? 'Saving…' : 'Save instructions'}</button>
          </form>
        ))}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18 }}>Subscriptions and entitlements</h2>
        {subscriptions.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No validation subscriptions yet.</p> : subscriptions.map((subscription) => <div key={subscription.id} className="list-row"><div className="list-row-main"><div className="list-row-title">{subscription.orgName} · {subscription.planName} <span className="chip">{subscription.status}</span></div><div className="list-row-meta">{subscription.product} · started {new Date(subscription.startsAt).toLocaleDateString()}{subscription.renewsAt ? ` · renews ${new Date(subscription.renewsAt).toLocaleDateString()}` : ''}</div></div></div>)}
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
