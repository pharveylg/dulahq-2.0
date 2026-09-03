'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

export async function createSession(clubId: string, teamId: string, formData: FormData) {
  const startsAtLocal = formData.get('startsAt') as string; // "YYYY-MM-DDTHH:mm" from <input type="datetime-local">
  const durationMinutes = parseInt((formData.get('durationMinutes') as string) || '60', 10);
  const notes = (formData.get('notes') as string)?.trim() || null;
  const theme = (formData.get('theme') as string)?.trim() || null;
  const objective = (formData.get('objective') as string)?.trim() || null;

  if (!startsAtLocal) return { error: 'Start date/time is required.' };
  const startsAt = new Date(startsAtLocal);
  if (isNaN(startsAt.getTime())) return { error: 'Invalid date/time.' };
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  const supabase = await createClient();
  const { error } = await supabase.from('training_sessions').insert({
    club_id: clubId,
    team_id: teamId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    notes,
    theme,
    objective,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

export async function updateSessionStatus(clubId: string, teamId: string, sessionId: string, status: 'scheduled' | 'cancelled' | 'completed') {
  const supabase = await createClient();
  const { error } = await supabase.from('training_sessions').update({ status }).eq('id', sessionId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

export async function deleteSession(clubId: string, teamId: string, sessionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('training_sessions').delete().eq('id', sessionId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}
