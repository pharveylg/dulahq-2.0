'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late' | 'no_response';

/**
 * Upserts one player's attendance for this session -- attendance has a
 * unique(training_session_id, player_id) constraint, so this is an
 * insert-or-update in one call rather than a check-then-branch.
 */
export async function setAttendance(
  clubId: string,
  teamId: string,
  sessionId: string,
  playerId: string,
  status: AttendanceStatus
) {
  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from('attendance')
    .upsert(
      { training_session_id: sessionId, player_id: playerId, status, created_by: dulaUser?.id },
      { onConflict: 'training_session_id,player_id' }
    );

  if (error) return { error: friendlyError(error) };
  revalidatePath(`/clubs/${clubId}/teams/${teamId}/training/${sessionId}`);
  return { success: true };
}
