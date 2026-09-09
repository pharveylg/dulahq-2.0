'use server';

import { revalidatePath } from 'next/cache';
import { createClient, isPlatformAdmin } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

const VALID_STATUSES = ['open', 'in_progress', 'waiting_on_org', 'resolved', 'closed'];

export async function updateSupportRequestStatus(requestId: string, status: string) {
  if (!(await isPlatformAdmin())) return { error: 'Platform admin only.' };
  if (!VALID_STATUSES.includes(status)) return { error: 'Invalid status.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('support_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) return { error: friendlyError(error) };

  revalidatePath('/platformconsole', 'page');
  return { success: true };
}

export async function platformReplySupportRequest(requestId: string, body: string) {
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

  revalidatePath('/platformconsole', 'page');
  return { success: true };
}
