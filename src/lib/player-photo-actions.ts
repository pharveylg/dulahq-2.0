'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { uploadFile, deleteFile } from '../../shared/files/lib/r2';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

/**
 * The checked RPC decides whether the caller may change this player's photo. The
 * new image is stored under a fresh key first and swapped in only once that check
 * passes, so a refused caller never replaces the photo that is already there.
 */
export async function uploadPlayerPhoto(playerId: string, formData: FormData) {
  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a photo to upload.' };
  if (!ALLOWED_TYPES.includes(file.type)) return { error: 'Use a JPEG, PNG or WebP image.' };
  if (file.size > MAX_BYTES) return { error: 'The photo must be 2 MB or smaller.' };

  const supabase = await createClient();
  const { data: player } = await supabase
    .from('players')
    .select('club_id, org_id, photo_key')
    .eq('id', playerId)
    .maybeSingle();
  if (!player?.club_id) return { error: 'You don’t have permission to do that.' };

  const { key } = await uploadFile({
    tenantId: player.club_id,
    category: 'profile',
    fileName: file.name,
    body: Buffer.from(await file.arrayBuffer()),
    contentType: file.type,
    orgId: player.org_id,
  });

  const { error } = await (supabase as any).rpc('set_player_photo', { p_player_id: playerId, p_key: key });
  if (error) {
    await deleteFile(key).catch(() => {});
    return { error: friendlyError(error) };
  }

  if (player.photo_key) await deleteFile(player.photo_key).catch(() => {});
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function removePlayerPhoto(playerId: string) {
  const supabase = await createClient();
  const { data: player } = await supabase.from('players').select('photo_key').eq('id', playerId).maybeSingle();
  const previousKey = player?.photo_key ?? null;

  const { error } = await (supabase as any).rpc('set_player_photo', { p_player_id: playerId, p_key: null });
  if (error) return { error: friendlyError(error) };

  if (previousKey) await deleteFile(previousKey).catch(() => {});
  revalidatePath('/', 'layout');
  return { success: true };
}
