'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/admin-auth';

const POSTER_BUCKET = 'tournament-posters';
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_POSTER_BYTES = 5 * 1024 * 1024; // matches the bucket's own file_size_limit

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501') return 'You don’t have permission to do that.';
  return error.message;
}

function posterPath(orgSlug: string, tournamentSlug: string) {
  // No extension: the mime type travels in Content-Type, not the URL, so the path
  // never changes when someone re-uploads in a different format -- nothing orphaned.
  return `${orgSlug}/${tournamentSlug}-poster`;
}

/**
 * Uploads a tournament poster and records it. Storage write goes through the service
 * role (storage.objects' own RLS on this bucket is platform-admin-only) -- the checked
 * step is set_tournament_poster(), called right after with the caller's own session, so
 * an Organizer or Treasurer without manage_tournament still can't set one even though
 * they reached this action. On that refusal the just-uploaded object is removed again.
 */
export async function uploadTournamentPoster(tournamentId: string, orgSlug: string, tournamentSlug: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in again to continue.' };

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { error: 'Choose an image to upload.' };
  if (!ALLOWED_MIME.includes(file.type)) return { error: 'Use a PNG, JPEG, WEBP or GIF image.' };
  if (file.size > MAX_POSTER_BYTES) return { error: 'Image is too large (5MB max).' };

  const path = posterPath(orgSlug, tournamentSlug);
  const admin = serviceClient();
  const { error: uploadError } = await admin.storage.from(POSTER_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) return { error: uploadError.message };

  const { data: pub } = admin.storage.from(POSTER_BUCKET).getPublicUrl(path);
  // Same path every time (upsert), so a cache-busting query string is the only way a
  // browser or CDN notices the new image.
  const url = `${pub.publicUrl}?v=${Date.now().toString(36)}`;

  const { error } = await supabase.rpc('set_tournament_poster', { p_tournament_id: tournamentId, p_poster_url: url });
  if (error) {
    await admin.storage.from(POSTER_BUCKET).remove([path]).catch(() => {});
    return { error: friendlyError(error) };
  }

  revalidatePath('/tm/[orgSlug]/[tournamentSlug]', 'page');
  revalidatePath('/platformconsole');
  revalidatePath('/tournaments');
  revalidatePath('/', 'layout');
  return { success: true as const, posterUrl: url };
}

export async function removeTournamentPoster(tournamentId: string, orgSlug: string, tournamentSlug: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_tournament_poster', { p_tournament_id: tournamentId, p_poster_url: null });
  if (error) return { error: friendlyError(error) };

  await serviceClient().storage.from(POSTER_BUCKET).remove([posterPath(orgSlug, tournamentSlug)]).catch(() => {});

  revalidatePath('/tm/[orgSlug]/[tournamentSlug]', 'page');
  revalidatePath('/platformconsole');
  revalidatePath('/tournaments');
  revalidatePath('/', 'layout');
  return { success: true as const };
}
