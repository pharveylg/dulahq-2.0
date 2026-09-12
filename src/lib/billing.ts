export type BillingContext = 'platform' | 'club' | 'tournament';
export type PaymentSubmissionStatus = 'submitted' | 'under_review' | 'verified' | 'rejected' | 'cancelled';

export const BILLING_CONTEXT_LABELS: Record<BillingContext, string> = {
  platform: 'Dula HQ platform',
  club: 'Club',
  tournament: 'Tournament',
};

export const PAYMENT_MODE = process.env.PAYMENT_MODE ?? 'manual_qr';

export function formatMoney(amount: number | string, currency = 'PHP') {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(amount) || 0);
}

export function paymentStatusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
