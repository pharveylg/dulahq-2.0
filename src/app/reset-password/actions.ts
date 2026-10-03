'use server';

import { createClient } from '@/lib/supabase/server';
import { checkNewPassword } from '@/lib/temp-password';

/**
 * Lands here only after /auth/confirm's verifyOtp has already established a
 * real session from the emailed recovery link -- this just sets the chosen
 * password on that session, the same supabase.auth.updateUser() call
 * change-password/actions.ts uses for the IT-issued-temp-password flow. No
 * must_change_password flag to clear here; that flag belongs to that other
 * flow only.
 */
export async function setNewPassword(password: string, confirm: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'That link has expired. Request a new one.' };

  if (password !== confirm) return { error: 'The two passwords don’t match.' };
  const problem = checkNewPassword(password, user.email ?? '');
  if (problem) return { error: problem };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { success: true as const };
}
