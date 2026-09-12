'use server';

import { revalidatePath } from 'next/cache';
import { createClient, isPlatformAdmin } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.toLowerCase().includes('not authorized')) return 'You don’t have permission to do that.';
  return error.message;
}

export async function createPlatformInvoice(formData: FormData) {
  if (!(await isPlatformAdmin())) return { error: 'Platform admin only.' };
  const orgId = String(formData.get('orgId') || '');
  const accountId = String(formData.get('billingAccountId') || '');
  const amount = Number(formData.get('amount'));
  const description = String(formData.get('description') || '').trim();
  if (!orgId || !accountId || !description || !Number.isFinite(amount) || amount <= 0) {
    return { error: 'Organization, billing account, description, and a positive amount are required.' };
  }

  const supabase = await createClient();
  const db = supabase as any;
  const { data, error } = await db.rpc('create_billing_invoice', {
    p_org_id: orgId,
    p_billing_account_id: accountId,
    p_context_type: 'platform',
    p_payer_type: 'organization',
    p_payer_org_id: orgId,
    p_payer_label: String(formData.get('payerLabel') || '').trim() || null,
    p_source_type: 'subscription',
    p_source_id: String(formData.get('sourceId') || '').trim() || null,
    p_currency: 'PHP',
    p_due_at: String(formData.get('dueAt') || '').trim() || null,
    p_notes: String(formData.get('notes') || '').trim() || null,
    p_lines: [{ description, unit_amount: amount, quantity: 1, source_type: 'subscription' }],
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/platformconsole');
  return { success: true, invoiceId: data };
}

export async function updatePlatformPaymentInstructions(accountId: string, formData: FormData) {
  if (!(await isPlatformAdmin())) return { error: 'Platform admin only.' };
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('update_billing_account_instructions', {
    p_account_id: accountId,
    p_payment_instructions: String(formData.get('paymentInstructions') || ''),
    p_qr_storage_key: String(formData.get('qrStorageKey') || '') || null,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/platformconsole');
  return { success: true };
}

export async function reviewPlatformPayment(paymentId: string, status: 'verified' | 'rejected' | 'cancelled', note: string) {
  if (!(await isPlatformAdmin())) return { error: 'Platform admin only.' };
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('review_billing_payment', {
    p_payment_id: paymentId,
    p_status: status,
    p_reviewer_note: note.trim() || null,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/platformconsole');
  return { success: true };
}
