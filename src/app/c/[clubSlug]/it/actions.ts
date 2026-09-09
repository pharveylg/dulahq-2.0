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
 * Starts a logged, time-limited "view as" session (Club Admin spec §10).
 *
 * This does NOT authenticate the caller as the target -- the spec's own
 * audit requirements forbid that (see the phase6o migration). The caller
 * stays themselves; the session only unlocks a read-only readout of the
 * target's effective access. Every guard (permission, reason, platform-admin
 * refusal, club membership, expiry) lives in start_impersonation() itself,
 * so this action cannot loosen any of them.
 */
export async function startViewAs(clubId: string, targetUserId: string, reason: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('start_impersonation', {
    p_target_user_id: targetUserId,
    p_club_id: clubId,
    p_reason: reason,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true, sessionId: data as string };
}

export async function endViewAs(sessionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('end_impersonation', { p_session_id: sessionId });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

/**
 * P1-11 (gap analysis): a reversible, IT-owned security lockout
 * (active <-> suspended), deliberately separate from the club manager's
 * "Remove" (active -> archived, permanent -- phase6z). Every guard lives in
 * set_staff_account_status() itself: the permission check, the self-action
 * refusal, and the "archived is not reversible from here" rule.
 */
export async function setStaffAccountStatus(clubId: string, targetUserId: string, status: 'active' | 'suspended') {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_staff_account_status', {
    p_club_id: clubId,
    p_target_user_id: targetUserId,
    p_status: status,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}
