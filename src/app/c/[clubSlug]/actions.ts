'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { uploadFile, deleteFile } from '../../../../shared/files/lib/r2';
import { parseClubBranding } from '@/lib/club-branding';

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
 * Gap analysis P0-6: the club's entire settings surface was a one-field
 * rename form. `about`/`location` columns and the `branding` jsonb bag
 * already existed and were seeded directly by SQL -- there was no UI path
 * to any of them. This is that path, plus a logo upload.
 *
 * The logo goes through R2 (shared/files/lib/r2 -- the same utility
 * MediaGallery already uses), not inline base64 in the branding column: an
 * image belongs in object storage, not bloating a jsonb row, and this app
 * already has the utility wired up and working.
 */
const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2MB -- a club mark, not a media upload
const LOGO_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

export async function updateClubProfile(clubId: string, formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const about = (formData.get('about') as string)?.trim() || null;
  const location = (formData.get('location') as string)?.trim() || null;
  const logoFile = formData.get('logo') as File | null;
  const removeLogo = formData.get('removeLogo') === 'true';
  if (!name) return { error: 'Club name is required.' };

  const supabase = await createClient();

  const { data: club } = await supabase.from('clubs').select('branding').eq('id', clubId).maybeSingle();
  const currentBranding = parseClubBranding(club?.branding);
  let nextBranding = currentBranding;
  let newKey: string | null = null;

  if (logoFile && logoFile.size > 0) {
    if (!LOGO_ALLOWED_TYPES.includes(logoFile.type)) {
      return { error: 'Logo must be JPEG, PNG, WebP, or SVG.' };
    }
    if (logoFile.size > LOGO_MAX_BYTES) return { error: 'Logo is too large (max 2MB).' };

    try {
      const buffer = Buffer.from(await logoFile.arrayBuffer());
      const { key } = await uploadFile({
        tenantId: clubId,
        category: 'branding',
        fileName: logoFile.name,
        body: buffer,
        contentType: logoFile.type,
      });
      newKey = key;
      nextBranding = { ...currentBranding, logoKey: key };
    } catch (e: any) {
      return { error: `Logo upload failed: ${e.message}` };
    }
  } else if (removeLogo) {
    nextBranding = { ...currentBranding, logoKey: undefined };
  }

  const { error } = await supabase
    .from('clubs')
    .update({ name, about, location, branding: nextBranding })
    .eq('id', clubId);

  if (error) {
    // The row update failed after a new logo was already written to R2 --
    // clean up the orphan rather than leaving it dangling, same pattern as
    // uploadMedia.
    if (newKey) await deleteFile(newKey).catch(() => {});
    return { error: friendlyError(error) };
  }

  // The old logo is only deleted once the row referencing the new one has
  // actually committed -- deleting it first and having the update fail
  // would leave the club with no logo file at all.
  if ((newKey || removeLogo) && currentBranding.logoKey && currentBranding.logoKey !== newKey) {
    await deleteFile(currentBranding.logoKey).catch(() => {});
  }

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

  const { data: inserted, error: insertError } = await supabase
    .from('club_staff')
    .insert({ club_id: clubId, user_id: existingUser.id, role })
    .select('id, org_id')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: `${existingUser.name ?? email} already has that role at this club.` };
    }
    return { error: friendlyError(insertError) };
  }

  // gap analysis P0-4: staff add/remove/reassign wrote zero audit rows.
  await supabase.rpc('write_audit', {
    p_org_id: inserted.org_id,
    p_action: 'staff.added',
    p_scope_type: 'club',
    p_scope_id: clubId,
    p_entity_type: 'club_staff',
    p_entity_id: inserted.id,
    p_after: { user_id: existingUser.id, name: existingUser.name, email, role },
  });

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

/**
 * "Remove" archives rather than deletes (gap analysis P0-5): club_staff had
 * no status lifecycle at all, unlike guardians' account_status, so a removed
 * coach's entire staffing history -- including who they even were --
 * vanished with them. The row now survives as `status='archived'`; every
 * authorization helper that reads club_staff.role (has_staff_permission,
 * is_club_staff, is_club_manager, is_org_member, and the IT/impersonation
 * functions) was updated in the same migration to require `status='active'`,
 * so an archived person keeps nothing -- this is a real removal of access,
 * not a soft delete in name only.
 *
 * Team assignments ARE removed outright (not archived) -- user_assigned_teams
 * has no history concept of its own (unlike team_memberships for players), so
 * leaving stale rows there would just make an archived person look like
 * they're still on a team in any UI that reads that table directly.
 */
export async function removeStaff(clubId: string, staffId: string) {
  const supabase = await createClient();

  const { data: staffRow } = await supabase
    .from('club_staff')
    .select('org_id, user_id, role')
    .eq('id', staffId)
    .maybeSingle();
  if (!staffRow) return { error: 'That staff member no longer exists.' };

  const { data: clubTeams } = await supabase.from('teams').select('id').eq('club_id', clubId);
  const teamIds = (clubTeams ?? []).map((t) => t.id);
  if (teamIds.length > 0) {
    await supabase.from('user_assigned_teams').delete().eq('user_id', staffRow.user_id).in('team_id', teamIds);
  }

  const { error } = await supabase.from('club_staff').update({ status: 'archived' }).eq('id', staffId);
  if (error) return { error: friendlyError(error) };

  await supabase.rpc('write_audit', {
    p_org_id: staffRow.org_id,
    p_action: 'staff.archived',
    p_scope_type: 'club',
    p_scope_id: clubId,
    p_entity_type: 'club_staff',
    p_entity_id: staffId,
    p_before: { user_id: staffRow.user_id, role: staffRow.role, status: 'active' },
    p_after: { status: 'archived' },
  });

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
  const { data: inserted, error } = await supabase
    .from('user_assigned_teams')
    .insert({ user_id: userId, team_id: teamId })
    .select('org_id')
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'Already assigned to that team.' };
    return { error: friendlyError(error) };
  }

  await supabase.rpc('write_audit', {
    p_org_id: inserted.org_id,
    p_action: 'staff.team_assigned',
    p_scope_type: 'club',
    p_scope_id: clubId,
    p_entity_type: 'team',
    p_entity_id: teamId,
    p_after: { user_id: userId },
  });

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

export async function unassignStaffFromTeam(clubId: string, userId: string, teamId: string) {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('user_assigned_teams')
    .select('org_id')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .maybeSingle();

  const { error, count } = await supabase
    .from('user_assigned_teams')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .eq('team_id', teamId);

  if (error) return { error: friendlyError(error) };

  // A DELETE that RLS refuses matches zero rows instead of raising -- so
  // without this a team manager trying to remove the primary coach (phase6x,
  // Team Manager spec §9) would be told it worked. The count is the only
  // signal there is.
  if (count === 0) {
    return {
      error:
        'That didn’t change anything — the primary coach can only be removed by someone who manages club staff.',
    };
  }

  if (before?.org_id) {
    await supabase.rpc('write_audit', {
      p_org_id: before.org_id,
      p_action: 'staff.team_unassigned',
      p_scope_type: 'club',
      p_scope_id: clubId,
      p_entity_type: 'team',
      p_entity_id: teamId,
      p_before: { user_id: userId },
    });
  }

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}

/**
 * phase6x. "Primary coach" is a fact about an assignment, not about a
 * person -- club_staff.role is club-wide, so it cannot say who leads which
 * team. The RPC does demote-then-promote in one step: the partial unique
 * index would reject the promote while the previous primary still stood, and
 * a caller doing it in two calls can leave the team with no lead at all.
 */
export async function setTeamPrimaryCoach(clubId: string, teamId: string, userId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_team_primary_coach', {
    p_team_id: teamId,
    p_user_id: userId,
  });
  if (error) return { error: friendlyError(error) };

  revalidatePath('/c/[clubSlug]', 'layout');
  return { success: true };
}
