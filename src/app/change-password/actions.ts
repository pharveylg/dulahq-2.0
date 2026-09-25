'use server';

import { createClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/admin-auth';
import { checkNewPassword } from '@/lib/temp-password';

/**
 * Lets someone who signed in with an IT-issued temporary password choose their own.
 * The password change goes through their own session; clearing the must-change flag
 * needs the service role because app_metadata is deliberately not user-editable.
 */
export async function changeTemporaryPassword(password: string, confirm: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in again to continue.' };

  if (password !== confirm) return { error: 'The two passwords don’t match.' };
  const problem = checkNewPassword(password, user.email ?? '');
  if (problem) return { error: problem };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: /different/i.test(error.message) ? 'Choose a new password, not the temporary one.' : error.message };
  }

  let admin;
  try { admin = serviceClient(); } catch (e) { return { error: (e as Error).message }; }
  const { error: flagError } = await admin.auth.admin.updateUserById(user.id, { app_metadata: { must_change_password: false } });
  if (flagError) return { error: flagError.message };
  await admin.rpc('mark_login_activated', { p_user_id: user.id });

  // The session's cached claims still say must_change_password; refresh so the
  // middleware sees the cleared flag on the very next request.
  await supabase.auth.refreshSession();
  return { success: true as const };
}
