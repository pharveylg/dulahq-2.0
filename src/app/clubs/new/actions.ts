'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function createClub(formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const orgId = (formData.get('org_id') as string)?.trim();

  if (!name) {
    return { error: 'Club name is required.' };
  }
  // clubs.org_id is NOT NULL (added 2026-08-27, see club-manager-design.md
  // "Tenant fencing fix") -- a club must belong to an organization.
  if (!orgId) {
    return { error: 'Choose which organization this club belongs to.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clubs')
    .insert({ name, org_id: orgId })
    .select()
    .single();

  if (error) {
    // RLS allows platform admins, or an org admin inserting for their own
    // org (is_org_admin(org_id)) -- a permission error here almost always
    // means the signed-in user isn't an admin of the org they picked, not
    // a bug. Surface that plainly rather than the raw Postgres error.
    if (error.code === '42501' || error.message.includes('row-level security')) {
      return { error: 'You need to be an admin of that organization (or a platform admin) to create a club there.' };
    }
    return { error: error.message };
  }

  redirect(`/clubs/${data.id}`);
}
