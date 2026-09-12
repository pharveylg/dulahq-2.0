import { describe, expect, it } from 'vitest';
import { calculateInvoiceStatus, calculateInvoiceTotals } from '../../src/lib/billing-calculations';

describe('billing invoice calculations', () => {
  it('calculates subtotal, discount, credit, and total', () => {
    expect(calculateInvoiceTotals([
      { quantity: 2, unitAmount: 1500 },
      { quantity: 1, unitAmount: 500 },
    ], 200, 100)).toEqual({
      subtotal: 3500,
      discountTotal: 200,
      creditTotal: 100,
      total: 3200,
    });
  });

  it('does not allow discounts or credits to create a negative invoice', () => {
    expect(calculateInvoiceTotals([{ quantity: 1, unitAmount: 100 }], 200, 200)).toEqual({
      subtotal: 100,
      discountTotal: 100,
      creditTotal: 0,
      total: 0,
    });
  });

  it('derives payment status from verified allocation only', () => {
    expect(calculateInvoiceStatus(1000, 0)).toBe('awaiting_payment');
    expect(calculateInvoiceStatus(1000, 400)).toBe('partially_paid');
    expect(calculateInvoiceStatus(1000, 1000)).toBe('paid');
    expect(calculateInvoiceStatus(1000, 1200)).toBe('paid');
  });
});
