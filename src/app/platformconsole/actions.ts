'use server';

import { revalidatePath } from 'next/cache';
import { createClient, isPlatformAdmin } from '@/lib/supabase/server';

// Mirrors org_entitlements' own product_check constraint -- filtered here
// too so a crafted request can't smuggle an arbitrary string into the
// `.not('product', 'in', ...)` filter string below.
const VALID_PRODUCTS = ['club', 'tournament'];

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
  const accent = (formData.get('accent') as string)?.trim() || '#059669';
  const adminEmail = (formData.get('adminEmail') as string)?.trim().toLowerCase();
  const clubName = (formData.get('clubName') as string)?.trim();
  const clubSlug = (formData.get('clubSlug') as string)?.trim().toLowerCase();
  const tournamentName = (formData.get('tournamentName') as string)?.trim();
  const tournamentSlug = (formData.get('tournamentSlug') as string)?.trim().toLowerCase();
  const products = (formData.getAll('products') as string[]).filter((p) => VALID_PRODUCTS.includes(p));

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return { error: 'Org slug must be lowercase letters, numbers, and hyphens only.' };
  if (!name) return { error: 'Organizer / business name is required.' };
  if (!adminEmail) return { error: 'Admin email is required so someone can actually sign in to this tenant.' };
  if (products.length === 0) return { error: 'Select at least one product (club or tournament) for this org.' };
  if (clubName && (!clubSlug || !/^[a-z0-9-]+$/.test(clubSlug))) {
    return { error: 'Club slug must be lowercase letters, numbers, and hyphens only.' };
  }
  if (clubName && !products.includes('club')) {
    return { error: 'Select the Club product to create a first club now, or leave the club fields blank.' };
  }
  if (tournamentName && (!tournamentSlug || !/^[a-z0-9-]+$/.test(tournamentSlug))) {
    return { error: 'Tournament slug must be lowercase letters, numbers, and hyphens only.' };
  }
  if (tournamentName && !products.includes('tournament')) {
    return { error: 'Select the Tournament product to create a first tournament now, or leave the tournament fields blank.' };
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

  // clubs/tournaments RLS gates writes on org_has_product(org_id, ...), so
  // entitlements have to exist before anything below tries to use them --
  // in particular the first-club insert a few lines down would otherwise
  // fail RLS even though the org and admin were just created successfully.
  const { error: entitlementError } = await supabase
    .from('org_entitlements')
    .insert(products.map((product) => ({ org_id: org.id, product })));
  if (entitlementError) {
    return { error: `Tenant created, but granting product access failed: ${friendlyError(entitlementError)}. Set it from the directory.` };
  }

  const { error: memberError } = await supabase.from('org_members').insert({ org_id: org.id, email: adminEmail, role: 'admin' });
  if (memberError) return { error: `Tenant created, but adding the admin failed: ${friendlyError(memberError)}. Add them from the directory.` };

  if (clubName) {
    const { error: clubError } = await supabase.from('clubs').insert({ org_id: org.id, name: clubName, slug: clubSlug });
    if (clubError) return { error: `Tenant and admin created, but the first club failed: ${friendlyError(clubError)}. Create it from /clubs/new instead.` };
  }

  if (tournamentName) {
    const { error: tournamentError } = await supabase.from('tournaments').insert({ org_id: org.id, name: tournamentName, slug: tournamentSlug });
    if (tournamentError) return { error: `Tenant and admin created, but the first tournament failed: ${friendlyError(tournamentError)}. Create it from the Tournament Manager's own console instead.` };
  }

  revalidatePath('/platformconsole');
  return { success: true, orgName: name, adminEmail };
}

/**
 * The Directory's per-org product toggle. Deleting a product's row (rather
 * than e.g. setting status='suspended') is deliberate -- it's the same
 * "no row = no access" state a freshly provisioned org starts in, so there's
 * only one way to represent "off" instead of two.
 */
export async function updateOrgEntitlements(orgId: string, formData: FormData) {
  if (!(await isPlatformAdmin())) return { error: 'Only a platform admin can do that.' };

  const products = (formData.getAll('products') as string[]).filter((p) => VALID_PRODUCTS.includes(p));
  const supabase = await createClient();

  if (products.length > 0) {
    const { error } = await supabase
      .from('org_entitlements')
      .upsert(
        products.map((product) => ({ org_id: orgId, product, status: 'active' })),
        { onConflict: 'org_id,product' }
      );
    if (error) return { error: friendlyError(error) };
  }

  let deleteQuery = supabase.from('org_entitlements').delete().eq('org_id', orgId);
  deleteQuery = products.length > 0 ? deleteQuery.not('product', 'in', `(${products.join(',')})`) : deleteQuery;
  const { error: deleteError } = await deleteQuery;
  if (deleteError) return { error: friendlyError(deleteError) };

  revalidatePath('/platformconsole');
  return { success: true };
}

export async function toggleOrgStatus(orgId: string, suspend: boolean) {
  if (!(await isPlatformAdmin())) return { error: 'Only a platform admin can do that.' };

  const supabase = await createClient();
  const { error } = await supabase.from('organizations').update({ status: suspend ? 'suspended' : 'active' }).eq('id', orgId);
  if (error) return { error: friendlyError(error) };

  revalidatePath('/platformconsole');
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

  revalidatePath('/platformconsole');
  return { success: true };
}
