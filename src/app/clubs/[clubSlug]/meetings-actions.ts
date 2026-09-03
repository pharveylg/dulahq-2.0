'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

export async function createMeeting(clubId: string, formData: FormData) {
  const title = (formData.get('title') as string)?.trim();
  if (!title) return { error: 'Title is required.' };

  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  const { error } = await supabase.from('meetings').insert({
    club_id: clubId,
    title,
    meeting_date: (formData.get('meetingDate') as string) || new Date().toISOString().slice(0, 10),
    location: (formData.get('location') as string)?.trim() || null,
    created_by: dulaUser?.id,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

export async function updateMeetingNotes(meetingId: string, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('meetings').update({ notes, updated_at: new Date().toISOString() }).eq('id', meetingId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

export async function updateMeetingStatus(meetingId: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('meetings').update({ status, updated_at: new Date().toISOString() }).eq('id', meetingId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

export async function deleteMeeting(meetingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('meetings').delete().eq('id', meetingId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

export async function addActionItem(meetingId: string, formData: FormData) {
  const description = (formData.get('description') as string)?.trim();
  if (!description) return { error: 'Description is required.' };

  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  const { error } = await supabase.from('meeting_action_items').insert({
    meeting_id: meetingId,
    description,
    due_date: (formData.get('dueDate') as string) || null,
    created_by: dulaUser?.id,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

export async function toggleActionItem(itemId: string, status: 'open' | 'done') {
  const supabase = await createClient();
  const { error } = await supabase.from('meeting_action_items').update({ status }).eq('id', itemId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

export async function deleteActionItem(itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('meeting_action_items').delete().eq('id', itemId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}
