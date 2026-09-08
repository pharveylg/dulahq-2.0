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
  const { data: updated, error } = await supabase
    .from('approval_requests')
    .update({
      status: decision,
      method: 'app',
      decided_at: new Date().toISOString(),
      decline_reason: decision === 'declined' ? declineReason!.trim() : null,
    })
    .eq('id', approvalRequestId)
    .select('org_id, subject_id, player_id')
    .single();

  if (error) return { error: friendlyError(error) };

  await supabase.rpc('write_audit', {
    p_org_id: updated.org_id,
    p_action: 'tournament.acknowledgement.decided',
    p_scope_type: 'tournament',
    p_entity_type: 'approval_request',
    p_entity_id: approvalRequestId,
    p_after: { decision, player_id: updated.player_id, entry_id: updated.subject_id, decline_reason: declineReason ?? null },
  });

  revalidatePath('/guardian', 'layout');
  return { success: true };
}
