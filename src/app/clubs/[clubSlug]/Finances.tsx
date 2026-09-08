'use client';

import { useState, useTransition, useActionState } from 'react';
import Reveal from '@/components/motion/Reveal';
import AnimatedNumber from '@/components/motion/AnimatedNumber';
import { createExpense, deleteExpense } from './finances-actions';
import { formatMoney, currencySymbol } from '@/lib/currency';

type FeeCharge = { id: string; playerName: string; feeType: string; amount: number; currency: string; status: string; dueDate: string | null };
type Expense = { id: string; description: string; category: string; amount: number; currency: string; expenseDate: string };

type ActionState = { error?: string };
const initialState: ActionState = {};

const CATEGORIES = ['venue', 'equipment', 'officiating', 'travel', 'uniform', 'admin', 'other'];

function Tile({ index, value, label, warn }: { index: number; value: React.ReactNode; label: string; warn?: boolean }) {
  return (
    <Reveal index={index} className="stat-tile">
      <div className="stat-value" style={warn ? { color: 'var(--warn)' } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
    </Reveal>
  );
}

export default function Finances({
  clubId,
  feeCharges,
  expenses,
  canManage,
}: {
  clubId: string;
  feeCharges: FeeCharge[];
  expenses: Expense[];
  canManage: boolean;
}) {
  const [expenseState, expenseAction, expensePending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => (await createExpense(clubId, formData)) ?? {},
    initialState
  );
  const [pending, startTransition] = useTransition();
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  function handleDeleteExpense(id: string) {
    startTransition(async () => {
      await deleteExpense(id);
    });
  }

  const collected = feeCharges.filter((f) => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0);
  const outstanding = feeCharges.filter((f) => f.status !== 'paid').reduce((sum, f) => sum + f.amount, 0);
  const overdueCount = feeCharges.filter((f) => f.status === 'overdue').length;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const net = collected - totalExpenses;
  // Every seeded club runs a single currency today; this picks whichever one
  // actually appears rather than hardcoding PHP, so a differently-configured
  // club's tiles still show its own symbol instead of the wrong one.
  const currency = feeCharges[0]?.currency ?? expenses[0]?.currency ?? 'PHP';
  const symbol = currencySymbol(currency);

  return (
    <>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20, marginBottom: 20 }}>
        <Tile index={0} value={<AnimatedNumber value={collected} prefix={symbol} decimals={2} />} label="Collected" />
        <Tile index={1} value={<AnimatedNumber value={outstanding} prefix={symbol} decimals={2} />} label="Outstanding" warn={outstanding > 0} />
        <Tile index={2} value={<AnimatedNumber value={overdueCount} />} label="Overdue charges" warn={overdueCount > 0} />
        <Tile index={3} value={<AnimatedNumber value={totalExpenses} prefix={symbol} decimals={2} />} label="Expenses" />
        <Tile index={4} value={<AnimatedNumber value={net} prefix={symbol} decimals={2} />} label="Net" warn={net < 0} />
      </div>

      <div className="section-label">Fee charges ({feeCharges.length})</div>
      <div className="card" style={{ marginBottom: 20 }}>
        {feeCharges.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No fee charges yet.</p>}
        {feeCharges.map((f) => (
          <div key={f.id} className="list-row">
            <div className="list-row-main">
              <div className="list-row-title">{f.playerName}</div>
              <div className="list-row-meta">
                {f.feeType} · {formatMoney(f.amount, f.currency)}
                {f.dueDate ? ` · due ${new Date(f.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
              </div>
            </div>
            <span
              className="chip"
              style={
                f.status === 'paid'
                  ? { color: 'var(--accent)', background: 'var(--accent-soft)', borderColor: 'var(--accent-soft-border)' }
                  : f.status === 'overdue'
                    ? { color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'var(--danger-soft-border)' }
                    : { color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn-soft-border)' }
              }
            >
              {f.status}
            </span>
          </div>
        ))}
      </div>

      <div className="section-label">Expenses ({expenses.length})</div>
      <div className="card">
        {expenses.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No expenses recorded.</p>}
        {expenses.map((e) => (
          <div key={e.id} className="list-row">
            <div className="list-row-main">
              <div className="list-row-title">{e.description}</div>
              <div className="list-row-meta">
                {e.category} · {new Date(e.expenseDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{formatMoney(e.amount, e.currency)}</span>
              {canManage && (
                <button className="btn" style={{ fontSize: 11 }} onClick={() => handleDeleteExpense(e.id)} disabled={pending}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <div style={{ marginTop: 12 }}>
          {!showExpenseForm ? (
            <button className="btn" onClick={() => setShowExpenseForm(true)}>+ Add expense</button>
          ) : (
            <form action={expenseAction} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="form-row" style={{ flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 2, minWidth: 160, marginBottom: 0 }}>
                  <input name="description" placeholder="Description" required />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 130, marginBottom: 0 }}>
                  <select name="category" required defaultValue="">
                    <option value="" disabled>Category</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 110, marginBottom: 0 }}>
                  <input name="amount" type="number" min={0} step={0.01} placeholder="Amount" required />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
                  <input name="expenseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
              </div>
              {expenseState?.error && <p className="error-text">{expenseState.error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={expensePending}>{expensePending ? 'Saving…' : 'Save expense'}</button>
                <button type="button" className="btn" onClick={() => setShowExpenseForm(false)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
