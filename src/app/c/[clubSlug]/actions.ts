'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don\u2019t have permission to do that.';
  }
  return error.message;
}

export async function updateClubName(clubId: string, formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  if (!name) return { error: 'Club name is required.' };

  const supabase = await createClient();
  const { error } = await supabase.from('clubs').update({ name }).eq('id', clubId);

  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

/**
 * Adds staff by EMAIL LOOKUP against the existing public.users table --
 * this app doesn't create accounts. If nobody with that email exists in
 * public.users yet, this fails with a clear message rather than
 * silently creating a partial record.
 */
export async function addStaff(clubId: string, formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const role = formData.get('role') as string;

  if (!email || !role) return { error: 'Email and role are required.' };

  const supabase = await createClient();

  const { data: existingUser, error: lookupError } = await supabase
    .from('users')
    .select('id, name')
    .eq('email', email)
    .maybeSingle();

  if (lookupError) return { error: friendlyError(lookupError) };
  if (!existingUser) {
    return {
      error: `No existing Dula HQ account found for ${email}. This app can't create new accounts -- ask an admin to add them first.`,
    };
  }

  const { error: insertError } = await supabase
    .from('club_staff')
    .insert({ club_id: clubId, user_id: existingUser.id, role });

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: `${existingUser.name ?? email} already has that role at this club.` };
    }
    return { error: friendlyError(insertError) };
  }

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function removeStaff(clubId: string, staffId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('club_staff').delete().eq('id', staffId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

/**
 * Links an EXISTING, currently-unclaimed team to this club. Does not
 * create a new team -- Club Manager never creates rows in the
 * Tournament-Manager-owned teams table, only sets the additive club_id.
 */
export async function linkTeam(clubId: string, formData: FormData) {
  const teamId = formData.get('teamId') as string;
  const slug = (formData.get('slug') as string)?.trim().toLowerCase();
  if (!teamId) return { error: 'Choose a team.' };
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return { error: 'Slug must be lowercase letters, numbers, and hyphens only.' };

  const supabase = await createClient();
  const { error, data } = await supabase
    .from('teams')
    .update({ club_id: clubId, slug })
    .eq('id', teamId)
    .select();

  if (error) {
    if (error.code === '23505') return { error: 'That slug is already used by another team in this club \u2014 pick another.' };
    return { error: friendlyError(error) };
  }
  if (!data || data.length === 0) {
    return { error: 'That team is already linked to a club, or doesn\u2019t exist.' };
  }

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

/**
 * Assigns a coach/team_manager to a specific team via the EXISTING
 * user_assigned_teams table -- not a new Club-Manager-only mechanism.
 */
export async function assignStaffToTeam(clubId: string, formData: FormData) {
  const userId = formData.get('userId') as string;
  const teamId = formData.get('teamId') as string;
  if (!userId || !teamId) return { error: 'Choose a team.' };

  const supabase = await createClient();
  const { error } = await supabase.from('user_assigned_teams').insert({ user_id: userId, team_id: teamId });

  if (error) {
    if (error.code === '23505') return { error: 'Already assigned to that team.' };
    return { error: friendlyError(error) };
  }

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function unassignStaffFromTeam(clubId: string, userId: string, teamId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('user_assigned_teams')
    .delete()
    .eq('user_id', userId)
    .eq('team_id', teamId);

  if (error) return { error: friendlyError(error) };
  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}
