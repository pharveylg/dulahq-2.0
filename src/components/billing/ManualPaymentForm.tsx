'use client';

import { useActionState } from 'react';
import { submitManualPayment } from '@/lib/billing-actions';
import { formatMoney } from '@/lib/billing';

type State = { error?: string; success?: boolean };

export default function ManualPaymentForm({ invoiceId, amountDue, currency = 'PHP', instructions }: { invoiceId: string; amountDue: number; currency?: string; instructions?: string | null }) {
  const [state, action, pending] = useActionState<State, FormData>(
    async (_previous, formData) => (await submitManualPayment(invoiceId, formData)) ?? {},
    {}
  );

  return (
    <form action={action} className="card" style={{ display: 'grid', gap: 10 }}>
      <div className="section-label">Manual payment</div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
        Pay {formatMoney(amountDue, currency)} using the QR code or instructions provided by the recipient, then submit the reference below. Verification is manual.
      </p>
      {instructions && <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface-muted)', fontSize: 13, whiteSpace: 'pre-wrap' }}>{instructions}</div>}
      <div className="form-row" style={{ flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: 140 }}><label>Amount</label><input name="amount" type="number" min="0.01" max={amountDue} step="0.01" defaultValue={amountDue.toFixed(2)} required /></div>
        <div className="form-group" style={{ flex: 1, minWidth: 140 }}><label>Method</label><select name="method" defaultValue="qr_transfer"><option value="qr_transfer">QR transfer</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="other">Other</option></select></div>
        <div className="form-group" style={{ flex: 2, minWidth: 180 }}><label>Reference number</label><input name="referenceNumber" placeholder="Payment reference" required /></div>
      </div>
      <div className="form-group"><label>Note</label><textarea name="payerNote" rows={2} placeholder="Optional note for the reviewer" /></div>
      {state.error && <p className="error-text">{state.error}</p>}
      {state.success && <p style={{ color: 'var(--accent)', fontSize: 13 }}>Payment submitted for verification.</p>}
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Submitting…' : 'Submit payment for verification'}</button>
    </form>
  );
}
