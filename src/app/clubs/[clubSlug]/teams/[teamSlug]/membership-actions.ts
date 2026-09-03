'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

// memberships.status has no DB check constraint, but this is the intended
// set per docs/club-manager-design.md -- enforced here in app code since
// the database won't.
const VALID_STATUSES = ['pending', 'active', 'expired', 'transferred'];

export async function addMembershipPeriod(clubId: string, teamId: string, playerId: string, formData: FormData) {
  const periodStart = formData.get('periodStart') as string;
  const periodEnd = (formData.get('periodEnd') as string) || null;
  const status = (formData.get('status') as string) || 'active';

  if (!periodStart) return { error: 'Start date is required.' };
  if (!VALID_STATUSES.includes(status)) return { error: 'Invalid status.' };

  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  const { error } = await supabase.from('memberships').insert({
    club_id: clubId,
    player_id: playerId,
    period_start: periodStart,
    period_end: periodEnd,
    status,
    created_by: dulaUser?.id,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

export async function updateMembershipStatus(clubId: string, teamId: string, membershipId: string, status: string) {
  if (!VALID_STATUSES.includes(status)) return { error: 'Invalid status.' };
  const supabase = await createClient();
  const { error } = await supabase.from('memberships').update({ status }).eq('id', membershipId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}
