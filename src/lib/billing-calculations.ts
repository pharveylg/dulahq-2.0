export type InvoiceLineInput = { quantity?: number; unitAmount: number };

export function calculateInvoiceTotals(lines: InvoiceLineInput[], discount = 0, credit = 0) {
  const subtotal = lines.reduce((sum, line) => {
    const quantity = Number.isFinite(line.quantity ?? 1) ? Math.max(line.quantity ?? 1, 0) : 0;
    const unitAmount = Number.isFinite(line.unitAmount) ? Math.max(line.unitAmount, 0) : 0;
    return sum + quantity * unitAmount;
  }, 0);
  const discountTotal = Math.min(Math.max(discount, 0), subtotal);
  const creditTotal = Math.min(Math.max(credit, 0), subtotal - discountTotal);
  const total = subtotal - discountTotal - creditTotal;
  return { subtotal, discountTotal, creditTotal, total };
}

export function calculateInvoiceStatus(total: number, paid: number) {
  const safeTotal = Math.max(total, 0);
  const safePaid = Math.max(paid, 0);
  if (safeTotal === 0 || safePaid >= safeTotal) return 'paid' as const;
  if (safePaid > 0) return 'partially_paid' as const;
  return 'awaiting_payment' as const;
}
