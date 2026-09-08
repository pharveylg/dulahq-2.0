'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

/**
 * Parent/Guardian spec §10-11: confirm or decline the player's tournament
 * participation. approval_requests' own check constraint requires a
 * decline_reason whenever status='declined' -- enforced here, not just at
 * the database, so the error reads as a form validation message rather
 * than a raw constraint violation.
 */
export async function decideAcknowledgement(approvalRequestId: string, decision: 'approved' | 'declined', declineReason?: string) {
  if (decision === 'declined' && !declineReason?.trim()) {
    return { error: 'Let the coach know why you’re declining.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('approval_requests')
    .update({
      status: decision,
      method: 'app',
      decided_at: new Date().toISOString(),
      decline_reason: decision === 'declined' ? declineReason!.trim() : null,
    })
    .eq('id', approvalRequestId);

  if (error) return { error: friendlyError(error) };
  revalidatePath('/guardian', 'layout');
  return { success: true };
}
