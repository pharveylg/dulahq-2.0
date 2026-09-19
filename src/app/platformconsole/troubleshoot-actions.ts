'use server';

import { revalidatePath } from 'next/cache';
import { createClient, isPlatformAdmin } from '@/lib/supabase/server';

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '42501' || error.message.toLowerCase().includes('not authorized') || error.message.toLowerCase().includes('platform admin only')) {
    return "You don't have permission to do that.";
  }
  return error.message;
}

export async function listOrgPeople(orgId: string) {
  if (!(await isPlatformAdmin())) return { error: 'Platform admin only.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('org_people_directory', { p_org_id: orgId });
  if (error) return { error: friendlyError(error) };
  return { people: data ?? [] };
}

export async function startPlatformViewAs(orgId: string, targetUserId: string, reason: string) {
  if (!(await isPlatformAdmin())) return { error: 'Platform admin only.' };
  if (!reason.trim()) return { error: 'A reason is required.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('start_platform_impersonation', {
    p_org_id: orgId,
    p_target_user_id: targetUserId,
    p_reason: reason.trim(),
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/platformconsole');

  // Read back the session the RPC just created rather than reconstructing it
  // client-side (expires_at depends on server clock/minutes clamp, not
  // something worth guessing).
  const { data } = await supabase.rpc('my_active_platform_impersonation');
  return { success: true, session: (data ?? [])[0] ?? null };
}

export async function endPlatformViewAs(sessionId: string) {
  if (!(await isPlatformAdmin())) return { error: 'Platform admin only.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('end_platform_impersonation', { p_session_id: sessionId });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/platformconsole');
  return { success: true };
}

export async function getEffectiveAccessForPlatform(targetUserId: string, orgId: string) {
  if (!(await isPlatformAdmin())) return { error: 'Platform admin only.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('effective_access_for_platform', {
    p_target_user_id: targetUserId,
    p_org_id: orgId,
  });
  if (error) return { error: friendlyError(error) };

  // A suspended org's members hold their permissions on paper but every gate
  // refuses them (phase9a). The readout above reports the paper permissions,
  // so without this an inspector would see a healthy bundle and conclude the
  // access problem lies elsewhere.
  const { data: org } = await supabase.from('organizations').select('status').eq('id', orgId).maybeSingle();
  return { readout: data, orgStatus: org?.status ?? null };
}
