'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function setPlayerPublicListing(playerId: string, show: boolean) {
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('set_player_public_listing', { p_player_id: playerId, p_show: show });
  if (error) {
    if (error.code === '42501') return { error: 'You can only change this for your own profile or a child you are a guardian of.' };
    return { error: error.message };
  }
  revalidatePath('/guardian');
  revalidatePath('/player');
  revalidatePath('/c/[clubSlug]', 'page');
  return { success: true };
}

export async function setPlayerPublicPhoto(playerId: string, show: boolean) {
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('set_player_public_photo', { p_player_id: playerId, p_show: show });
  if (error) {
    if (error.code === '42501') return { error: 'You can only change this for your own profile or a child you are a guardian of.' };
    return { error: error.message };
  }
  revalidatePath('/c/[clubSlug]', 'page');
  return { success: true };
}
