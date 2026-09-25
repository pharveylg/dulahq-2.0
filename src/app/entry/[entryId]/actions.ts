'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/** The team manager tells the host a payment was made. The host verifies it in the tournament console. */
export async function submitEntryPayment(entryId: string, invoiceId: string, formData: FormData) {
  const amount = Number(formData.get('amount'));
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter the amount you paid.' };
  const reference = String(formData.get('reference') ?? '').trim();
  if (!reference) return { error: 'Enter the payment reference so the organizer can find it.' };

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('submit_entry_payment', {
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_method: String(formData.get('method') ?? 'qr_transfer'),
    p_reference: reference,
    p_note: String(formData.get('note') ?? '') || null,
  });
  if (error) {
    if (error.code === '42501') return { error: 'Only the team manager for this entry can submit a payment.' };
    return { error: error.message };
  }
  revalidatePath(`/entry/${entryId}`);
  return { success: true as const };
}
