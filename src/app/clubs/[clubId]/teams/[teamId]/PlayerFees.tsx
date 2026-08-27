'use client';

import { useState, useTransition } from 'react';
import { addFeeCharge, recordPayment, updateFeeChargeStatus } from './fees-actions';

type Payment = { id: string; amount: number; method: string | null; paid_at: string };
type FeeCharge = {
  id: string;
  feeType: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'refunded';
  dueDate: string | null;
  payments: Payment[];
};

const FEE_TYPES = ['registration', 'membership', 'training', 'uniform', 'equipment', 'transportation', 'accommodation', 'other'];

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  paid: { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' },
  overdue: { color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'var(--danger-soft-border)' },
  pending: { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' },
  refunded: { color: 'var(--blue)', background: 'var(--blue-soft)', borderColor: 'var(--blue-soft-border)' },
};

function ChargeRow({ clubId, teamId, playerId, charge, canManage }: { clubId: string; teamId: string; playerId: string; charge: FeeCharge; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);

  const paid = charge.payments.reduce((sum, p) => sum + p.amount, 0);

  function handlePay(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await recordPayment(clubId, teamId, charge.id, formData);
      if (result?.error) setError(result.error);
      else setShowPay(false);
    });
  }

  function handleMarkOverdue() {
    setError(null);
    startTransition(async () => {
      const result = await updateFeeChargeStatus(clubId, teamId, charge.id, 'overdue');
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13 }}>
          {charge.feeType} — {charge.currency} {charge.amount.toFixed(2)}
          {charge.dueDate && <span style={{ color: 'var(--text-muted)' }}> · due {charge.dueDate}</span>}
          {paid > 0 && <span style={{ color: 'var(--text-muted)' }}> · {charge.currency} {paid.toFixed(2)} paid</span>}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="chip" style={STATUS_STYLE[charge.status]}>{charge.status}</span>
          {canManage && charge.status !== 'paid' && !showPay && (
            <button className="btn" style={{ fontSize: 11 }} onClick={() => setShowPay(true)}>Record payment</button>
          )}
          {canManage && charge.status === 'pending' && (
            <button className="btn" style={{ fontSize: 11 }} onClick={handleMarkOverdue} disabled={pending}>Mark overdue</button>
          )}
        </div>
      </div>
      {showPay && (
        <form action={handlePay} className="form-row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 90 }}>
            <input name="amount" type="number" step="0.01" min={0} placeholder="Amount" defaultValue={charge.amount - paid} required />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 110 }}>
            <select name="method" defaultValue="cash">
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ fontSize: 12 }} disabled={pending}>
            {pending ? 'Saving…' : 'Save payment'}
          </button>
        </form>
      )}
      {error && <p className="error-text" style={{ marginTop: 4 }}>{error}</p>}
    </div>
  );
}

export default function PlayerFees({ clubId, teamId, playerId, charges, canManage }: { clubId: string; teamId: string; playerId: string; charges: FeeCharge[]; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addFeeCharge(clubId, teamId, playerId, formData);
      if (result?.error) setError(result.error);
      else setShowAdd(false);
    });
  }

  return (
    <div style={{ paddingLeft: 2 }}>
      {charges.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No charges yet.</p>}
      {charges.map((c) => (
        <ChargeRow key={c.id} clubId={clubId} teamId={teamId} playerId={playerId} charge={c} canManage={canManage} />
      ))}

      {canManage && !showAdd && (
        <button className="btn" style={{ fontSize: 11.5, marginTop: 6 }} onClick={() => setShowAdd(true)}>
          + Add charge
        </button>
      )}
      {canManage && showAdd && (
        <form action={handleAdd} className="form-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 130 }}>
            <select name="feeType" defaultValue="registration">
              {FEE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 90 }}>
            <input name="amount" type="number" step="0.01" min={0} placeholder="Amount" required />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 130 }}>
            <input name="dueDate" type="date" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending} style={{ fontSize: 12 }}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}
      {error && <p className="error-text" style={{ marginTop: 4 }}>{error}</p>}
    </div>
  );
}
