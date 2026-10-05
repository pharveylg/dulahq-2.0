import 'server-only';
import { serviceClient } from '@/lib/admin-auth';

/**
 * Signs a QR key for a server component that has already loaded the key through an
 * authorized query. Deliberately not exported from a 'use server' module: as an action,
 * a browser could call it with any key.
 */
export async function signBillingQrKey(key: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    const { data } = await serviceClient().storage.from('billing-qr').createSignedUrl(key, 600);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
