'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

const VALID_FEE_TYPES = ['registration', 'membership', 'training', 'uniform', 'equipment', 'transportation', 'accommodation', 'other'];

export async function addFeeCharge(clubId: string, teamId: string, playerId: string, formData: FormData) {
  const feeType = formData.get('feeType') as string;
  const amountRaw = (formData.get('amount') as string)?.trim();
  const dueDate = (formData.get('dueDate') as string) || null;

  if (!VALID_FEE_TYPES.includes(feeType)) return { error: 'Choose a fee type.' };
  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount < 0) return { error: 'Enter a valid amount.' };

  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  const { error } = await supabase.from('fee_charges').insert({
    club_id: clubId,
    player_id: playerId,
    fee_type: feeType,
    amount,
    due_date: dueDate,
    created_by: dulaUser?.id,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function recordPayment(clubId: string, teamId: string, feeChargeId: string, formData: FormData) {
  const amountRaw = (formData.get('amount') as string)?.trim();
  const method = (formData.get('method') as string)?.trim() || null;

  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount < 0) return { error: 'Enter a valid amount.' };

  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  const { error: paymentError } = await supabase
    .from('payments')
    .insert({ fee_charge_id: feeChargeId, amount, method, created_by: dulaUser?.id });
  if (paymentError) return { error: friendlyError(paymentError) };

  // Marking the charge 'paid' here is a simple v1 rule (one payment = paid
  // in full) -- partial payments still record correctly against the
  // charge, but the status won't reflect "partially paid" as its own
  // state since fee_charges.status only allows pending/paid/overdue/refunded.
  const { error: statusError } = await supabase.from('fee_charges').update({ status: 'paid' }).eq('id', feeChargeId);
  if (statusError) return { error: friendlyError(statusError) };

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function updateFeeChargeStatus(clubId: string, teamId: string, feeChargeId: string, status: 'pending' | 'paid' | 'overdue' | 'refunded') {
  const supabase = await createClient();
  const { error } = await supabase.from('fee_charges').update({ status }).eq('id', feeChargeId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}
