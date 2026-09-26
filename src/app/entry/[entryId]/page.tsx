import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/billing';
import EntryPaymentForm from './EntryPaymentForm';

type Submission = { id: string; amount: number; status: string; method: string; reference_number: string | null; reviewer_note: string | null; submitted_at: string };
type Invoice = { id: string; invoice_number: string; status: string; currency: string; total: number; amount_paid: number; due_at: string | null; pending_amount: number; submissions: Submission[] };
type Portal = {
  entry: { id: string; team_name: string; status: string; tournament_name: string; host_org_name: string; category_name: string | null };
  my_role: string;
  instructions: string | null;
  announcements: { id: string; title: string; body: string; author_name: string | null; created_at: string }[];
  invoices: Invoice[];
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Waiting for the organizer to decide',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};
const INVOICE_LABEL: Record<string, string> = {
  issued: 'Payment due',
  awaiting_payment: 'Payment due',
  submitted_for_verification: 'Payment sent, waiting for verification',
  partially_paid: 'Part paid',
  paid: 'Paid',
  overdue: 'Overdue',
  waived: 'Waived',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  rejected: 'Rejected',
};
const OPEN = ['issued', 'awaiting_payment', 'submitted_for_verification', 'partially_paid', 'overdue'];

/**
 * A team contact's view of one tournament entry: where the entry stands, what is owed,
 * how to pay, and a form to tell the organizer a payment was made. Everything is read
 * through entrant_entry_portal(), which refuses anyone who is not an active contact of
 * this entry -- these people belong to no organization, so the tables themselves stay
 * closed to them.
 */
export default async function EntryPortalPage({ params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await (supabase as any).rpc('entrant_entry_portal', { p_entry_id: entryId });
  if (error || !data) notFound();
  const portal = data as Portal;
  const canPay = portal.my_role === 'team_manager';

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 720 }}>
        <Link href="/" className="back-link">← Home</Link>
        <div className="page-header">
          <div>
            <h1>{portal.entry.team_name}</h1>
            <p className="subtitle">
              {portal.entry.tournament_name} · {portal.entry.host_org_name}
              {portal.entry.category_name ? ` · ${portal.entry.category_name}` : ''}
            </p>
          </div>
          <span className="chip">{STATUS_LABEL[portal.entry.status] ?? portal.entry.status}</span>
        </div>

        {portal.announcements.length > 0 && (
          <>
            <div className="section-label">Announcements</div>
            {portal.announcements.map((a) => (
              <div key={a.id} className="card" style={{ marginBottom: 12 }}>
                <div className="list-row-title">{a.title}</div>
                <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', margin: '4px 0' }}>{a.body}</div>
                <div className="list-row-meta">{a.author_name ?? portal.entry.host_org_name} · {new Date(a.created_at).toLocaleString()}</div>
              </div>
            ))}
          </>
        )}

        <div className="section-label">Fees</div>
        {portal.invoices.length === 0 && (
          <div className="card"><p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>No fees have been issued for this entry.</p></div>
        )}
        {portal.invoices.map((inv) => {
          const total = Number(inv.total);
          const paid = Number(inv.amount_paid);
          const pending = Number(inv.pending_amount);
          const due = Math.max(total - paid - pending, 0);
          return (
            <div key={inv.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div className="list-row-title">{inv.invoice_number}</div>
                  <div className="list-row-meta">
                    {formatMoney(total, inv.currency)} total · {formatMoney(paid, inv.currency)} paid
                    {inv.due_at ? ` · due ${new Date(inv.due_at).toLocaleDateString()}` : ''}
                  </div>
                </div>
                <span className="chip">{INVOICE_LABEL[inv.status] ?? inv.status}</span>
              </div>

              {inv.submissions.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {inv.submissions.map((s) => (
                    <div key={s.id} className="list-row-meta" style={{ padding: '2px 0' }}>
                      {formatMoney(Number(s.amount), inv.currency)} by {s.method.replace('_', ' ')}
                      {s.reference_number ? ` (${s.reference_number})` : ''} — {s.status}
                      {s.status === 'rejected' && s.reviewer_note ? `: ${s.reviewer_note}` : ''}
                    </div>
                  ))}
                </div>
              )}

              {OPEN.includes(inv.status) && due > 0 && (
                <>
                  {portal.instructions && (
                    <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'var(--surface-muted)', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                      {portal.instructions}
                    </div>
                  )}
                  {canPay ? (
                    <EntryPaymentForm entryId={entryId} invoiceId={inv.id} amountDue={due} currency={inv.currency} />
                  ) : (
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '10px 0 0' }}>
                      Payments are sent by your team manager.
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
