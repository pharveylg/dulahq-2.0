'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { uploadFile, deleteFile } from '../../../../shared/files/lib/r2';

const TYPES = ['waiver', 'insurance', 'roster_form', 'other'] as const;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501') return 'You don’t have permission to do that.';
  return error.message;
}

/** A team contact submits a document for their entry (waiver, insurance proof, roster form). */
export async function submitEntryDocument(entryId: string, formData: FormData) {
  const type = formData.get('type') as string;
  const name = (formData.get('name') as string)?.trim();
  const file = formData.get('file') as File | null;
  if (!TYPES.includes(type as (typeof TYPES)[number])) return { error: 'Choose a document type.' };
  if (!name) return { error: 'Give the document a name.' };
  if (!file || file.size === 0) return { error: 'Choose a file to upload.' };
  if (file.size > MAX_FILE_BYTES) return { error: 'File is too large (8MB max).' };

  const { key } = await uploadFile({
    tenantId: entryId,
    category: 'documents',
    fileName: file.name,
    body: Buffer.from(await file.arrayBuffer()),
    contentType: file.type || 'application/octet-stream',
  });

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('submit_entry_document', {
    p_entry_id: entryId, p_type: type, p_name: name, p_storage_key: key, p_file_name: file.name, p_mime_type: file.type || null,
  });
  if (error) {
    await deleteFile(key).catch(() => {});
    return { error: friendlyError(error) };
  }
  revalidatePath(`/entry/${entryId}`);
  return { success: true };
}
