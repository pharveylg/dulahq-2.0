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
 * P1-10 (gap analysis §12). support_requests has no club_id -- eligibility
 * is "holds submit_support_request at some club in this org", checked by
 * the RLS policy itself (support_requests_insert), not here; this action
 * just supplies org_id (derived from the club the caller is standing in,
 * not taken from the client) and created_by.
 */
export async function createSupportRequest(clubId: string, formData: FormData) {
  const category = formData.get('category') as string;
  const subject = (formData.get('subject') as string)?.trim();
  const body = (formData.get('body') as string)?.trim();
  if (!subject || !body) return { error: 'Subject and description are required.' };

  const supabase = await createClient();
  const { data: dulaUser } = await supabase.auth.getUser();
  if (!dulaUser.user) return { error: 'Not signed in.' };

  const { data: club } = await supabase.from('clubs').select('org_id').eq('id', clubId).maybeSingle();
  if (!club) return { error: 'Club not found.' };

  const { error } = await supabase.from('support_requests').insert({
    org_id: club.org_id,
    created_by: dulaUser.user.id,
    category,
    subject,
    body,
  });
  if (error) return { error: friendlyError(error) };

  revalidatePath('/c/[clubSlug]/support', 'page');
  return { success: true };
}

export async function replySupportRequest(requestId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { error: 'Say something before sending.' };

  const supabase = await createClient();
  const { data: dulaUser } = await supabase.auth.getUser();
  if (!dulaUser.user) return { error: 'Not signed in.' };

  const { error } = await supabase.from('support_request_messages').insert({
    request_id: requestId,
    author_user_id: dulaUser.user.id,
    body: trimmed,
  });
  if (error) return { error: friendlyError(error) };

  revalidatePath('/c/[clubSlug]/support', 'page');
  return { success: true };
}
