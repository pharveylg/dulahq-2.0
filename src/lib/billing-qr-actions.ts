'use server';

import { revalidatePath } from 'next/cache';
import { serviceClient } from '@/lib/admin-auth';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'billing-qr';
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

/**
 * The checked RPC decides whether the caller may change this account's QR. The
 * image is written under a fresh key first and only swapped in once that check
 * passes, so a refused caller can never overwrite the QR that is already there.
 */
export async function uploadBillingQr(accountId: string, formData: FormData) {
  const file = formData.get('qr');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image to upload.' };
  if (!TYPES.includes(file.type)) return { error: 'Use a PNG, JPEG or WebP image.' };
  if (file.size > MAX_BYTES) return { error: 'The image must be 5 MB or smaller.' };

  const supabase = await createClient();
  const { data: account } = await (supabase as any).from('billing_accounts').select('qr_storage_key').eq('id', accountId).maybeSingle();
  const previousKey = account?.qr_storage_key ?? null;

  let admin;
  try { admin = serviceClient(); } catch (e) { return { error: (e as Error).message }; }

  const key = `${accountId}/qr-${crypto.randomUUID()}`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(key, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (uploadError) return { error: 'Could not store the image. Try again.' };

  const { error } = await (supabase as any).rpc('set_billing_account_qr', { p_account_id: accountId, p_qr_key: key });
  if (error) {
    await admin.storage.from(BUCKET).remove([key]);
    return { error: friendlyError(error) };
  }

  if (previousKey) await admin.storage.from(BUCKET).remove([previousKey]);
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function removeBillingQr(accountId: string) {
  const supabase = await createClient();
  const { data: account } = await (supabase as any).from('billing_accounts').select('qr_storage_key').eq('id', accountId).maybeSingle();
  const previousKey = account?.qr_storage_key ?? null;

  const { error } = await (supabase as any).rpc('set_billing_account_qr', { p_account_id: accountId, p_qr_key: null });
  if (error) return { error: friendlyError(error) };

  if (previousKey) {
    try { await serviceClient().storage.from(BUCKET).remove([previousKey]); } catch { /* the database no longer points at it */ }
  }
  revalidatePath('/', 'layout');
  return { success: true };
}

/**
 * Short-lived link to the QR for the viewer. Reading billing_accounts is the
 * check: RLS only returns the row to the named payer and to finance holders, so
 * a user who can't read the account gets nothing, and no key is ever signed for them.
 */
export async function getBillingQrUrl(accountId: string) {
  const supabase = await createClient();
  const { data: account } = await (supabase as any).from('billing_accounts').select('qr_storage_key').eq('id', accountId).maybeSingle();
  if (!account?.qr_storage_key) return { url: null };
  try {
    const { data } = await serviceClient().storage.from(BUCKET).createSignedUrl(account.qr_storage_key, 600);
    return { url: data?.signedUrl ?? null };
  } catch {
    return { url: null };
  }
}
