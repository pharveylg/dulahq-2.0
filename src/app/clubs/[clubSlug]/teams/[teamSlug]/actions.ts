'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentDulaUser } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return 'You don’t have permission to do that.';
  }
  return error.message;
}

export async function addPlayer(clubId: string, teamId: string, formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  if (!name) return { error: 'Player name is required.' };

  const jersey = (formData.get('jersey') as string)?.trim() || null;
  const position = (formData.get('position') as string)?.trim() || null;
  const age = (formData.get('age') as string)?.trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from('players').insert({ team_id: teamId, name, jersey, position, age });

  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

export async function removePlayer(clubId: string, teamId: string, playerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('players').delete().eq('id', playerId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

/**
 * Creates a new guardian record and links it to this player in one step.
 * v1 scope: every "add guardian" creates a fresh guardians row rather than
 * searching/reusing an existing one (e.g. a parent with two kids at the
 * club) -- reusing guardians across players is a reasonable follow-up, not
 * done here.
 */
export async function addGuardian(clubId: string, teamId: string, playerId: string, formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  if (!name) return { error: 'Guardian name is required.' };

  const relationship = (formData.get('relationship') as string)?.trim() || 'parent';
  const phone = (formData.get('phone') as string)?.trim();
  const email = (formData.get('email') as string)?.trim();

  const dulaUser = await getCurrentDulaUser();
  if (!dulaUser) return { error: 'Not signed in.' };

  const supabase = await createClient();

  const { data: guardian, error: guardianError } = await supabase
    .from('guardians')
    .insert({
      name,
      created_by: dulaUser.id,
      contact_info: { phone: phone || null, email: email || null },
    })
    .select()
    .single();

  if (guardianError) return { error: friendlyError(guardianError) };

  const { error: linkError } = await supabase
    .from('player_guardians')
    .insert({ player_id: playerId, guardian_id: guardian.id, relationship });

  if (linkError) return { error: friendlyError(linkError) };

  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

/**
 * Removes the player<->guardian link, not the guardian record itself --
 * the same guardian might (eventually) be linked to other players. An
 * orphaned guardian row left behind by this is acceptable cleanup debt,
 * not a correctness issue.
 */
export async function removeGuardianLink(clubId: string, teamId: string, playerGuardianId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('player_guardians').delete().eq('id', playerGuardianId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

/**
 * Marks a guardian as invited so they can self-claim an account at
 * /guardian-signup (RBAC Phase 3) -- doesn't send an email itself, that's
 * Supabase Auth's own signup-confirmation email once they actually sign
 * up. This step just flips the flag that lets the claim policies on
 * guardians recognize them ("account_status = 'invited'").
 */
export async function inviteGuardian(clubId: string, teamId: string, guardianId: string, email: string) {
  if (!email?.trim()) return { error: 'This guardian needs an email on file before they can be invited.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('guardians')
    .update({ account_status: 'invited', invited_at: new Date().toISOString() })
    .eq('id', guardianId);

  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

/**
 * Links an existing Dula HQ account to this player (RBAC Phase 4) --
 * staff/guardian-initiated by email lookup, the same pattern as
 * AddStaffForm's addStaff, deliberately NOT a public player-signup route.
 * Building self-service signup for a player means deciding a minor-consent
 * policy, which isn't an engineering call -- this sidesteps that
 * entirely by requiring the account to already exist and an adult
 * (staff or the linked guardian) to do the linking.
 */
export async function linkPlayerAccount(clubId: string, teamId: string, playerId: string, formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  if (!email) return { error: 'Email is required.' };

  const supabase = await createClient();

  const { data: existingUser, error: lookupError } = await supabase
    .from('users')
    .select('id, name')
    .eq('email', email)
    .maybeSingle();

  if (lookupError) return { error: friendlyError(lookupError) };
  if (!existingUser) {
    return { error: `No existing Dula HQ account found for ${email}. They need to sign up (or be added as staff/guardian) first.` };
  }

  const { error: linkError } = await supabase.from('players').update({ user_id: existingUser.id }).eq('id', playerId);
  if (linkError) return { error: friendlyError(linkError) };

  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}

export async function unlinkPlayerAccount(clubId: string, teamId: string, playerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('players').update({ user_id: null }).eq('id', playerId);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/clubs/[clubSlug]', 'layout');
  return { success: true };
}
