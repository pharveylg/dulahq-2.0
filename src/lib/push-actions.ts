'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Upserts the calling user's push subscription for this device (Phase 5a,
 * CLAUDE.md §0c). Thin wrapper -- save_push_subscription() is
 * SECURITY DEFINER specifically so re-subscribing a shared device under a
 * different account reassigns the row instead of hitting the self-only
 * RLS policy's USING clause on the *previous* owner's row.
 */
export async function savePushSubscription(endpoint: string, p256dh: string, authKey: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth_key: authKey,
  });
  if (error) return { error: error.message };
  return { success: true };
}
