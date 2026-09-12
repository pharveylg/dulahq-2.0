'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.toLowerCase().includes('not authorized')) return 'You don’t have permission to do that.';
  return error.message;
}

/** Submit an externally completed QR/bank transfer for a payer-visible invoice. */
export async function submitManualPayment(invoiceId: string, formData: FormData) {
  const amount = Number(formData.get('amount'));
  if (!invoiceId || !Number.isFinite(amount) || amount <= 0) return { error: 'Enter a valid payment amount.' };

  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('submit_billing_payment', {
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_method: String(formData.get('method') || 'qr_transfer'),
    p_reference_number: String(formData.get('referenceNumber') || '').trim() || null,
    p_proof_storage_key: String(formData.get('proofStorageKey') || '').trim() || null,
    p_payer_note: String(formData.get('payerNote') || '').trim() || null,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/', 'layout');
  return { success: true, paymentId: data };
}
