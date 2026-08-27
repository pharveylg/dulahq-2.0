'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

const VALID_AUDIENCES = ['club', 'team', 'players', 'guardians', 'coaches', 'staff', 'tournament_participants', 'trip_participants'];

export async function createAnnouncement(clubId: string, formData: FormData) {
  const title = (formData.get('title') as string)?.trim();
  const body = (formData.get('body') as string)?.trim();
  const audience = formData.get('audience') as string;
  const teamId = (formData.get('teamId') as string) || null;
  const pinned = formData.get('pinned') === 'on';

  if (!title || !body) return { error: 'Title and body are required.' };
  if (!VALID_AUDIENCES.includes(audience)) return { error: 'Choose an audience.' };
  if (audience === 'team' && !teamId) return { error: 'Choose which team this announcement is for.' };

  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  const { error } = await supabase.from('announcements').insert({
    club_id: clubId,
    title,
    body,
    audience,
    team_id: audience === 'team' ? teamId : null,
    pinned,
    created_by: dulaUser?.id,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}

export async function togglePin(clubId: string, announcementId: string, pinned: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from('announcements').update({ pinned }).eq('id', announcementId);
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}

export async function deleteAnnouncement(clubId: string, announcementId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('announcements').delete().eq('id', announcementId);
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}
