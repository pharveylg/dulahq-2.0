'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { uploadFile, deleteFile } from '../../../../shared/files/lib/r2';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const PHOTO_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * P1-7 (gap analysis §1). One row per club_staff row (self-service by
 * default -- staff_profiles_write's RLS also lets a club_manager/org_admin
 * edit someone else's, but no UI for that exists yet, deliberately: the
 * primary need was "does a person have anywhere to put their own bio,
 * phone, and certifications", not an admin-edits-everyone workflow).
 */
export async function upsertMyStaffProfile(clubId: string, formData: FormData) {
  const supabase = await createClient();

  const { data: dulaUser } = await supabase.auth.getUser();
  if (!dulaUser.user) return { error: 'Not signed in.' };

  const { data: myStaffRow } = await supabase
    .from('club_staff')
    .select('id, org_id')
    .eq('club_id', clubId)
    .eq('user_id', dulaUser.user.id)
    .maybeSingle();
  if (!myStaffRow) return { error: 'You are not staff at this club.' };

  const phone = (formData.get('phone') as string)?.trim() || null;
  const bio = (formData.get('bio') as string)?.trim() || null;
  const certificationsRaw = (formData.get('certifications') as string) ?? '[]';
  const photoFile = formData.get('photo') as File | null;
  const removePhoto = formData.get('removePhoto') === 'true';

  let certifications: unknown;
  try {
    certifications = JSON.parse(certificationsRaw);
    if (!Array.isArray(certifications)) throw new Error('not an array');
  } catch {
    return { error: 'Certifications were malformed — try again.' };
  }

  const { data: existing } = await supabase
    .from('staff_profiles')
    .select('photo_key')
    .eq('club_staff_id', myStaffRow.id)
    .maybeSingle();

  let photoKey = existing?.photo_key ?? null;
  let uploadedKey: string | null = null;

  if (photoFile && photoFile.size > 0) {
    if (!PHOTO_ALLOWED_TYPES.includes(photoFile.type)) return { error: 'Photo must be JPEG, PNG, or WebP.' };
    if (photoFile.size > PHOTO_MAX_BYTES) return { error: 'Photo is too large (max 2MB).' };
    try {
      const buffer = Buffer.from(await photoFile.arrayBuffer());
      const { key } = await uploadFile({
        tenantId: clubId,
        category: 'profile',
        fileName: photoFile.name,
        body: buffer,
        contentType: photoFile.type,
      });
      uploadedKey = key;
      photoKey = key;
    } catch (e: any) {
      return { error: `Photo upload failed: ${e.message}` };
    }
  } else if (removePhoto) {
    photoKey = null;
  }

  const { error } = await supabase.from('staff_profiles').upsert({
    club_staff_id: myStaffRow.id,
    club_id: clubId,
    org_id: myStaffRow.org_id,
    phone,
    bio,
    photo_key: photoKey,
    certifications,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    if (uploadedKey) await deleteFile(uploadedKey).catch(() => {});
    return { error: friendlyError(error) };
  }

  if ((uploadedKey || removePhoto) && existing?.photo_key && existing.photo_key !== uploadedKey) {
    await deleteFile(existing.photo_key).catch(() => {});
  }

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}
