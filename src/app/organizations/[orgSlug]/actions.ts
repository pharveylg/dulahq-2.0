'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

/**
 * Phase 2 of docs/proposals/self-serve-org-onboarding.md. One atomic RPC grants
 * trial org_entitlements + billing_subscriptions for the chosen products, sharing
 * one trial clock across whatever this org has already started.
 */
export async function startProductTrial(orgId: string, formData: FormData) {
  const products = (formData.getAll('products') as string[]).filter((p) => p === 'club' || p === 'tournament');
  if (products.length === 0) return { error: 'Choose at least one product.' };

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('start_product_trial', { p_org_id: orgId, p_products: products });
  if (error) return { error: friendlyError(error) };

  revalidatePath('/organizations/[orgSlug]', 'page');
  return { success: true };
}

/**
 * Pay now, via the existing manual billing path (§0q/§0m) -- no new payment
 * infrastructure. A $0 plan (every plan today) settles immediately; a priced plan
 * sits awaiting payment until Platform Admin verifies it the same way they already
 * do for tournament and platform invoices, which flips the entitlement to active.
 */
export async function requestProductUpgrade(orgId: string, product: 'club' | 'tournament') {
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('request_org_product_upgrade', { p_org_id: orgId, p_product: product });
  if (error) return { error: friendlyError(error) };

  revalidatePath('/organizations/[orgSlug]', 'page');
  return { success: true, status: data.status as string };
}
