'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

const VALID_PURPOSES = ['training', 'tournament', 'camp', 'match', 'other'];

export async function createTrip(clubId: string, formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const purpose = formData.get('purpose') as string;
  const startsAtLocal = formData.get('startsAt') as string;
  const endsAtLocal = formData.get('endsAt') as string;

  if (!name) return { error: 'Trip name is required.' };
  if (!VALID_PURPOSES.includes(purpose)) return { error: 'Choose a purpose.' };

  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  const { error } = await supabase.from('trips').insert({
    club_id: clubId,
    name,
    purpose,
    starts_at: startsAtLocal ? new Date(startsAtLocal).toISOString() : null,
    ends_at: endsAtLocal ? new Date(endsAtLocal).toISOString() : null,
    created_by: dulaUser?.id,
  });

  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}
