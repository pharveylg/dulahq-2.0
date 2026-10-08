'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Phase 1 of docs/proposals/self-serve-org-onboarding.md. The one atomic RPC
 * (create_self_serve_organization) creates the org, makes the caller its first
 * admin, and starts the 24-hour unclaimed-shell clock -- no product entitlement
 * yet. Unlike provisionTenant, this authorizes off the verified session alone.
 */
export async function createSelfServeOrganization(formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const slugInput = (formData.get('slug') as string)?.trim();
  if (!name) return { error: 'Organization name is required.' };
  const slug = slugify(slugInput || name);
  if (!slug) return { error: 'Choose a web address using letters, numbers and hyphens.' };

  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('create_self_serve_organization', { p_name: name, p_slug: slug });
  if (error) return { error: friendlyError(error) };

  redirect(`/organizations/${data.slug}`);
}
