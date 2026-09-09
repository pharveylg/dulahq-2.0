'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';
import { notifyAboutPlayer } from '@/lib/notify';
import { TYPE_CATEGORY } from '@/lib/document-types';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

const VALID_TYPES = Object.keys(TYPE_CATEGORY);
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function uploadDocument(clubId: string, teamId: string, playerId: string, playerName: string, formData: FormData) {
  const type = formData.get('type') as string;
  const name = (formData.get('name') as string)?.trim();
  const file = formData.get('file') as File | null;

  if (!VALID_TYPES.includes(type)) return { error: 'Choose a document type.' };
  if (!name) return { error: 'Give the document a name.' };
  if (!file || file.size === 0) return { error: 'Choose a file to upload.' };
  if (file.size > MAX_FILE_BYTES) return { error: 'File is too large (8MB max).' };

  const fileData = Buffer.from(await file.arrayBuffer()).toString('base64');
  const supabase = await createClient();

  const { error } = await supabase.from('document_uploads').insert({
    team_id: teamId,
    player_id: playerId,
    player_name: playerName,
    type,
    category: TYPE_CATEGORY[type],
    name,
    file_name: file.name,
    file_data: fileData,
    mime_type: file.type || null,
    status: 'pending',
  });

  if (error) return { error: friendlyError(error) };

  await notifyAboutPlayer({
    playerId,
    template: 'document.uploaded',
    payload: { title: 'New document added', body: name },
  });

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function reviewDocument(documentId: string, playerId: string, status: 'approved' | 'rejected', note: string) {
  const dulaUser = await getCurrentDulaUser();
  const supabase = await createClient();

  const { data: document, error } = await supabase
    .from('document_uploads')
    .update({
      status,
      review_note: note.trim() || null,
      reviewed_by: dulaUser?.name ?? dulaUser?.email ?? null,
      reviewed_by_role: dulaUser?.role ?? null,
    })
    .eq('id', documentId)
    .select('name')
    .single();

  if (error) return { error: friendlyError(error) };

  await notifyAboutPlayer({
    playerId,
    template: 'document.reviewed',
    payload: { title: status === 'approved' ? 'Document approved' : 'Document needs attention', body: document?.name ?? 'A document was reviewed' },
  });

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function deleteDocument(documentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('document_uploads').delete().eq('id', documentId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}
