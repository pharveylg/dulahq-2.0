'use server';

import { revalidatePath } from 'next/cache';
import { createClient, isPlatformAdmin } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

/**
 * Creates a new tenant (organization) + its first admin, modeled on
 * DulaHQ's own Superadmin Console provisioning flow (organizations
 * insert, then an org_members admin row) -- optionally its first club
 * too, the same way DulaHQ's provisioning also creates the org's first
 * tournament in one step.
 */
export async function provisionTenant(formData: FormData) {
  if (!(await isPlatformAdmin())) return { error: 'Only a platform admin can provision tenants.' };

  const slug = (formData.get('slug') as string)?.trim().toLowerCase();
  const name = (formData.get('name') as string)?.trim();
  const accent = (formData.get('accent') as string)?.trim() || '#15803D';
  const adminEmail = (formData.get('adminEmail') as string)?.trim().toLowerCase();
  const clubName = (formData.get('clubName') as string)?.trim();
  const clubSlug = (formData.get('clubSlug') as string)?.trim().toLowerCase();

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return { error: 'Org slug must be lowercase letters, numbers, and hyphens only.' };
  if (!name) return { error: 'Organizer / business name is required.' };
  if (!adminEmail) return { error: 'Admin email is required so someone can actually sign in to this tenant.' };
  if (clubName && (!clubSlug || !/^[a-z0-9-]+$/.test(clubSlug))) {
    return { error: 'Club slug must be lowercase letters, numbers, and hyphens only.' };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase.from('organizations').select('id').eq('slug', slug).maybeSingle();
  if (existing) return { error: 'That org slug is already registered — pick another.' };

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ slug, name, accent, status: 'active' })
    .select()
    .single();
  if (orgError) return { error: friendlyError(orgError) };

  const { error: memberError } = await supabase.from('org_members').insert({ org_id: org.id, email: adminEmail, role: 'admin' });
  if (memberError) return { error: `Tenant created, but adding the admin failed: ${friendlyError(memberError)}. Add them from the directory.` };

  if (clubName) {
    const { error: clubError } = await supabase.from('clubs').insert({ org_id: org.id, name: clubName, slug: clubSlug });
    if (clubError) return { error: `Tenant and admin created, but the first club failed: ${friendlyError(clubError)}. Create it from /clubs/new instead.` };
  }

  revalidatePath('/clubs/platformconsole');
  return { success: true, orgName: name, adminEmail };
}

export async function toggleOrgStatus(orgId: string, suspend: boolean) {
  if (!(await isPlatformAdmin())) return { error: 'Only a platform admin can do that.' };

  const supabase = await createClient();
  const { error } = await supabase.from('organizations').update({ status: suspend ? 'suspended' : 'active' }).eq('id', orgId);
  if (error) return { error: friendlyError(error) };

  revalidatePath('/clubs/platformconsole');
  return { success: true };
}

export async function renameOrganization(orgId: string, formData: FormData) {
  if (!(await isPlatformAdmin())) return { error: 'Only a platform admin can do that.' };

  const name = (formData.get('name') as string)?.trim();
  const accent = (formData.get('accent') as string)?.trim();
  if (!name) return { error: 'Name is required.' };

  const supabase = await createClient();
  const { error } = await supabase.from('organizations').update({ name, accent: accent || undefined }).eq('id', orgId);
  if (error) return { error: friendlyError(error) };

  revalidatePath('/clubs/platformconsole');
  return { success: true };
}
