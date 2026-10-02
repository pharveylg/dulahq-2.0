'use server';

import { revalidatePath } from 'next/cache';
import { serviceClient } from '@/lib/admin-auth';
import { notifyUser } from '@/lib/notify';
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

async function requesterSupportPath(orgId: string, userId: string): Promise<string | undefined> {
  try {
    const admin = serviceClient();
    const { data: staff } = await admin
      .from('club_staff')
      .select('club_id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    const clubId = staff?.club_id;
    let clubQuery = admin.from('clubs').select('slug').eq('org_id', orgId);
    if (clubId) clubQuery = clubQuery.eq('id', clubId);
    const { data: club } = await clubQuery.order('name').limit(1).maybeSingle();
    return club?.slug ? `/c/${club.slug}/support` : undefined;
  } catch {
    return undefined;
  }
}

export async function platformReplySupportRequest(requestId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { error: 'Say something before sending.' };
  if (!(await isPlatformAdmin())) return { error: 'Platform admin only.' };

  const supabase = await createClient();
  const { data: dulaUser } = await supabase.auth.getUser();
  if (!dulaUser.user) return { error: 'Not signed in.' };

  const { error } = await supabase.from('support_request_messages').insert({
    request_id: requestId,
    author_user_id: dulaUser.user.id,
    body: trimmed,
  });
  if (error) return { error: friendlyError(error) };

  const { data: request } = await supabase
    .from('support_requests')
    .select('org_id, created_by, subject')
    .eq('id', requestId)
    .maybeSingle();
  if (request && request.created_by !== dulaUser.user.id) {
    await notifyUser({
      orgId: request.org_id,
      recipientUserId: request.created_by,
      template: 'support.request.platform_reply',
      payload: { title: 'Dula HQ replied to your support request', body: request.subject },
      linkPath: await requesterSupportPath(request.org_id, request.created_by),
    });
  }

  revalidatePath('/platformconsole', 'page');
  return { success: true };
}
