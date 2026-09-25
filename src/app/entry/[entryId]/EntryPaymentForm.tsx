'use client';

import { useActionState } from 'react';
import { submitEntryPayment } from './actions';

type State = { error?: string; success?: boolean };

export default function EntryPaymentForm({ entryId, invoiceId, amountDue, currency }: {
  entryId: string; invoiceId: string; amountDue: number; currency: string;
}) {
  const [state, action, pending] = useActionState<State, FormData>(
    async (_prev, formData) => (await submitEntryPayment(entryId, invoiceId, formData)) ?? {},
    {},
  );
  return (
    <form action={action} style={{ display: 'grid', gap: 10, marginTop: 10 }}>
      <div className="form-row" style={{ flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: 130 }}>
          <label htmlFor={`amt-${invoiceId}`}>Amount paid</label>
          <input id={`amt-${invoiceId}`} name="amount" type="number" min="0.01" max={amountDue} step="0.01" defaultValue={amountDue.toFixed(2)} required />
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 130 }}>
          <label htmlFor={`method-${invoiceId}`}>How you paid</label>
          <select id={`method-${invoiceId}`} name="method" defaultValue="qr_transfer">
            <option value="qr_transfer">QR transfer</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: 2, minWidth: 170 }}>
          <label htmlFor={`ref-${invoiceId}`}>Payment reference</label>
          <input id={`ref-${invoiceId}`} name="reference" placeholder="Reference number or receipt" required />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor={`note-${invoiceId}`}>Note for the organizer (optional)</label>
        <textarea id={`note-${invoiceId}`} name="note" rows={2} />
      </div>
      {state.error && <p className="error-text" role="alert">{state.error}</p>}
      {state.success && <p style={{ color: 'var(--accent)', fontSize: 13 }}>Sent. The organizer will verify it.</p>}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Sending…' : 'Send payment for verification'}
      </button>
    </form>
  );
}
