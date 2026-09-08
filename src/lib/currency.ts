/**
 * fee_charges.currency / expenses.currency are free-text (a club could in
 * principle run in any currency), so this formats whatever code is stored
 * rather than assuming PHP -- PHP is just the new default for rows that
 * don't set one explicitly (see phase2n_default_currency_php).
 */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(amount);
  } catch {
    // Intl throws on a currency code it doesn't recognize -- fall back to
    // the old "CODE amount" display rather than crashing the page.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Just the symbol ("₱", "$"), for prefixing a number rendered separately (e.g. an animated counter). */
export function currencySymbol(currency: string): string {
  try {
    const part = new Intl.NumberFormat('en-PH', { style: 'currency', currency })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}
