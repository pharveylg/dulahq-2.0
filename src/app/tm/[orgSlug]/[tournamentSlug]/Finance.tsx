'use client';

import { useState, useTransition } from 'react';
import { formatMoney } from '@/lib/currency';
import { recordPayment, reviewPayment, saveInstructions } from './actions';

export type FinanceInvoice = {
  id: string;
  number: string;
  payer: string | null;
  total: number;
  paid: number;
  status: string;
  currency: string;
  dueAt: string | null;
};
export type PendingPayment = {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  payerNote: string | null;
  submittedAt: string;
};

const METHODS: { value: string; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'qr_transfer', label: 'QR transfer' },
  { value: 'other', label: 'Other' },
];
const methodLabel = (m: string) => METHODS.find((x) => x.value === m)?.label ?? m;

const STATUS_LABEL: Record<string, string> = {
  issued: 'Issued',
  awaiting_payment: 'Awaiting payment',
  submitted_for_verification: 'Payment submitted',
  partially_paid: 'Part paid',
  paid: 'Paid',
  rejected: 'Payment rejected',
  overdue: 'Overdue',
};
// Invoices that can still take money. Anything else (draft, paid, waived,
// refunded, cancelled) is closed or not yet issued.
const OPEN = new Set(['issued', 'awaiting_payment', 'submitted_for_verification', 'partially_paid', 'rejected', 'overdue']);
// What counts as "billed": everything actually issued and not written off.
const BILLED = new Set([...OPEN, 'paid']);

function useRun() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<{ error?: string } | undefined>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
      else onDone?.();
    });
  }
  return { pending, error, run };
}

function Tile({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  return (
    <div className="stat-tile">
      <div className="stat-value" style={warn ? { color: 'var(--warn)' } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function PaymentToVerify({ payment, label, canManage }: { payment: PendingPayment; label: string; canManage: boolean }) {
  const { pending, error, run } = useRun();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="list-row-main">
          <div className="list-row-title">{label} · {formatMoney(payment.amount, payment.currency)}</div>
          <div className="list-row-meta">
            {methodLabel(payment.method)}
            {payment.reference ? ` · ref ${payment.reference}` : ''}
            {' · '}submitted {new Date(payment.submittedAt).toLocaleString()}
            {payment.payerNote ? ` · “${payment.payerNote}”` : ''}
          </div>
        </div>
        {canManage && !rejecting && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={pending}
              onClick={() => run(() => reviewPayment(payment.id, 'verified', ''))}>
              {pending ? 'Working…' : 'Verify'}
            </button>
            <button className="btn" style={{ fontSize: 12 }} disabled={pending} onClick={() => setRejecting(true)}>Reject</button>
          </div>
        )}
      </div>
      {rejecting && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is it being rejected?"
            style={{ flex: 1, minWidth: 220 }} aria-label="Rejection reason" />
          <button className="btn" style={{ fontSize: 12 }} disabled={pending}
            onClick={() => run(() => reviewPayment(payment.id, 'rejected', reason))}>
            {pending ? 'Working…' : 'Confirm reject'}
          </button>
          <button className="btn" style={{ fontSize: 12 }} disabled={pending} onClick={() => { setRejecting(false); setReason(''); }}>Cancel</button>
        </div>
      )}
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}

function InvoiceRow({ invoice, canManage }: { invoice: FinanceInvoice; canManage: boolean }) {
  const { pending, error, run } = useRun();
  const [open, setOpen] = useState(false);
  const remaining = Math.max(invoice.total - invoice.paid, 0);
  const canTakePayment = canManage && OPEN.has(invoice.status) && remaining > 0;

  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="list-row-main">
          <div className="list-row-title">
            {invoice.payer ?? 'Unnamed payer'}{' '}
            <span className="chip">{STATUS_LABEL[invoice.status] ?? invoice.status}</span>
          </div>
          <div className="list-row-meta">
            {invoice.number} · {formatMoney(invoice.paid, invoice.currency)} paid of {formatMoney(invoice.total, invoice.currency)}
            {invoice.dueAt ? ` · due ${new Date(invoice.dueAt).toLocaleDateString()}` : ''}
          </div>
        </div>
        {canTakePayment && !open && (
          <button className="btn" style={{ fontSize: 12 }} onClick={() => setOpen(true)}>Record payment</button>
        )}
      </div>
      {open && (
        <form
          className="card"
          style={{ display: 'grid', gap: 10, margin: 0 }}
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            run(() => recordPayment(invoice.id, formData), () => setOpen(false));
          }}
        >
          <div className="form-row" style={{ flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 130, marginBottom: 0 }}>
              <label htmlFor={`amt-${invoice.id}`}>Amount received</label>
              <input id={`amt-${invoice.id}`} name="amount" type="number" step="0.01" min="0.01" max={remaining}
                defaultValue={remaining.toFixed(2)} required />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
              <label htmlFor={`method-${invoice.id}`}>How</label>
              <select id={`method-${invoice.id}`} name="method" defaultValue="cash">
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
              <label htmlFor={`ref-${invoice.id}`}>Receipt or reference</label>
              <input id={`ref-${invoice.id}`} name="reference" placeholder="Optional" />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor={`note-${invoice.id}`}>Note</label>
            <input id={`note-${invoice.id}`} name="note" placeholder="Optional" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Record payment'}</button>
            <button type="button" className="btn" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}

function Instructions({ accountId, initial, canManage }: { accountId: string; initial: string; canManage: boolean }) {
  const { pending, error, run } = useRun();
  const [saved, setSaved] = useState(false);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="section-label">How teams pay you</div>
      {canManage ? (
        <form
          style={{ display: 'grid', gap: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            setSaved(false);
            run(() => saveInstructions(accountId, formData), () => setSaved(true));
          }}
        >
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
            Shown to a team when it pays an invoice — your GCash number, bank account, or where to hand over cash.
          </p>
          <textarea name="instructions" rows={3} defaultValue={initial} aria-label="Payment instructions"
            placeholder="e.g. GCash 0917 000 0000 (Dennis M.) — put your team name in the message" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save instructions'}</button>
            {saved && <span style={{ fontSize: 13, color: 'var(--accent)' }}>Saved.</span>}
          </div>
          {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
        </form>
      ) : (
        <p style={{ margin: 0, fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{initial || 'No payment instructions set yet.'}</p>
      )}
    </div>
  );
}

export default function Finance({
  accountId,
  instructions,
  invoices,
  pendingPayments,
  canManage,
}: {
  accountId: string | null;
  instructions: string;
  invoices: FinanceInvoice[];
  pendingPayments: PendingPayment[];
  canManage: boolean;
}) {
  if (!accountId) {
    return <div className="card"><p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>This tournament has no billing account yet.</p></div>;
  }

  const currency = invoices[0]?.currency ?? 'PHP';
  const billed = invoices.filter((i) => BILLED.has(i.status));
  const totalBilled = billed.reduce((n, i) => n + i.total, 0);
  const collected = billed.reduce((n, i) => n + i.paid, 0);
  const outstanding = billed.reduce((n, i) => n + Math.max(i.total - i.paid, 0), 0);
  const labelFor = (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    return inv ? `${inv.payer ?? 'Unnamed payer'} (${inv.number})` : 'Unknown invoice';
  };
  const open = invoices.filter((i) => OPEN.has(i.status));
  const closed = invoices.filter((i) => !OPEN.has(i.status));

  return (
    <>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20, marginBottom: 20 }}>
        <Tile value={formatMoney(totalBilled, currency)} label="Billed" />
        <Tile value={formatMoney(collected, currency)} label="Collected" />
        <Tile value={formatMoney(outstanding, currency)} label="Outstanding" warn={outstanding > 0} />
        <Tile value={String(pendingPayments.length)} label="To verify" warn={pendingPayments.length > 0} />
      </div>

      <Instructions accountId={accountId} initial={instructions} canManage={canManage} />

      <div className="section-label">Payments to verify ({pendingPayments.length})</div>
      <div className="card" style={{ marginBottom: 20 }}>
        {pendingPayments.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Nothing waiting. Payments a team submits appear here; cash or transfers you received yourself can be recorded on the invoice below.
          </p>
        )}
        {pendingPayments.map((p) => (
          <PaymentToVerify key={p.id} payment={p} label={labelFor(p.invoiceId)} canManage={canManage} />
        ))}
      </div>

      <div className="section-label">Open invoices ({open.length})</div>
      <div className="card" style={{ marginBottom: 20 }}>
        {open.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            No open invoices. Issue one when you add an entry on the Entries tab.
          </p>
        )}
        {open.map((i) => <InvoiceRow key={i.id} invoice={i} canManage={canManage} />)}
      </div>

      {closed.length > 0 && (
        <>
          <div className="section-label">Settled and closed ({closed.length})</div>
          <div className="card">
            {closed.map((i) => <InvoiceRow key={i.id} invoice={i} canManage={canManage} />)}
          </div>
        </>
      )}
    </>
  );
}
