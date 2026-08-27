'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';
import { uploadFile, deleteFile } from '../../../../shared/files/lib/r2';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

const MAX_BYTES = 8 * 1024 * 1024; // 8MB, under the 10MB server-action body limit (next.config.js)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function uploadMedia(clubId: string, formData: FormData) {
  const file = formData.get('file') as File | null;
  const caption = (formData.get('caption') as string)?.trim() || null;

  if (!file || file.size === 0) return { error: 'Choose a photo.' };
  if (!ALLOWED_TYPES.includes(file.type)) return { error: 'Only JPEG, PNG, WebP, or GIF images are supported.' };
  if (file.size > MAX_BYTES) return { error: 'File is too large (max 8MB).' };

  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  // R2 has no tenant isolation of its own -- the RLS check on the
  // following `media` insert IS the permission check; uploadFile just
  // writes bytes under a club-scoped key prefix (see shared/files/README.md).
  let key: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    ({ key } = await uploadFile({
      tenantId: clubId,
      category: 'media',
      fileName: file.name,
      body: buffer,
      contentType: file.type,
    }));
  } catch (e: any) {
    return { error: `Upload failed: ${e.message}` };
  }

  const { error } = await supabase.from('media').insert({
    club_id: clubId,
    r2_key: key,
    file_name: file.name,
    content_type: file.type,
    caption,
    created_by: dulaUser?.id,
  });

  if (error) {
    // Row insert failed after the file was already written to R2 -- clean
    // up the orphaned object rather than leaving it dangling.
    await deleteFile(key).catch(() => {});
    return { error: friendlyError(error) };
  }

  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}

export async function deleteMedia(clubId: string, mediaId: string) {
  const supabase = await createClient();

  const { data: media, error: fetchError } = await supabase.from('media').select('r2_key').eq('id', mediaId).maybeSingle();
  if (fetchError) return { error: friendlyError(fetchError) };
  if (!media) return { error: 'Not found.' };

  const { error } = await supabase.from('media').delete().eq('id', mediaId);
  if (error) return { error: friendlyError(error) };

  await deleteFile(media.r2_key).catch(() => {});

  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}
