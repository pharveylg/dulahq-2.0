'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501') return 'You don’t have permission to do that.';
  return error.message;
}

/**
 * Turns a club's or tournament's public directory listing on or off. The
 * database decides who may (set_public_listing / the guard_listing_flags
 * trigger): the IT admin roles, an org admin, or a platform admin turn it on;
 * anyone who administers it can turn it off.
 */
export async function setPublicListing(kind: 'club' | 'tournament', id: string, listed: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_public_listing', { p_kind: kind, p_id: id, p_listed: listed });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/', 'layout');
  return { success: true };
}

/** Platform admin only: hides a listing regardless of the owner's choice. */
export async function setListingBlock(kind: 'club' | 'tournament', id: string, blocked: boolean, reason: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_listing_block', { p_kind: kind, p_id: id, p_blocked: blocked, p_reason: reason ?? '' });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/', 'layout');
  return { success: true };
}
