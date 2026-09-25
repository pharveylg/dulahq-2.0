'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { serviceClient, newTempPassword } from '@/lib/admin-auth';
import { looksLikeEmail, TEMP_PASSWORD_HOURS } from '@/lib/temp-password';

type Scope = 'club' | 'tournament' | 'platform';

function scopeArgs(scope: Scope, scopeId: string | null) {
  return { p_scope_type: scope, p_scope_id: scope === 'platform' ? null : scopeId };
}

function friendly(error: { code?: string; message: string }) {
  if (error.code === '42501') return 'You don’t have permission to do that.';
  return error.message;
}

/**
 * Creates a login for a person and returns a random temporary password ONCE.
 *
 * Order matters: the database says whether this caller may (can_provision_login)
 * BEFORE the service-role client is touched, and the record of who issued it is
 * written by the caller's own session after the account exists, so the audit row
 * names the admin. If recording fails the new account is deleted again, so no
 * login exists that nobody can later reissue or see.
 */
export async function provisionLogin(scope: Scope, scopeId: string | null, name: string, email: string) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  if (!cleanName) return { error: 'Enter the person’s name.' };
  if (!looksLikeEmail(cleanEmail)) return { error: 'Enter a valid email address.' };

  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc('can_provision_login', scopeArgs(scope, scopeId));
  if (!allowed) return { error: 'You don’t have permission to create logins here.' };

  let admin;
  try { admin = serviceClient(); } catch (e) { return { error: (e as Error).message }; }

  const password = newTempPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: { name: cleanName },
    app_metadata: { must_change_password: true },
  });
  if (createError || !created.user) {
    if (createError && /already|registered|exists/i.test(createError.message)) {
      return { error: 'That email already has an account. Ask the person to sign in, or ask the person who manages them to add them by email.' };
    }
    return { error: createError?.message ?? 'Could not create the login.' };
  }

  const { error: recordError } = await supabase.rpc('record_provisioned_login', {
    p_user_id: created.user.id,
    p_email: cleanEmail,
    p_name: cleanName,
    p_hours: TEMP_PASSWORD_HOURS,
    ...scopeArgs(scope, scopeId),
  });
  if (recordError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: friendly(recordError) };
  }

  revalidatePath('/', 'layout');
  return { success: true as const, email: cleanEmail, name: cleanName, password, hours: TEMP_PASSWORD_HOURS };
}

/**
 * Issues a fresh temporary password for a login this same scope created (a platform
 * admin may reissue any ordinary account). Reissue lifts an expiry ban and forces
 * another password change. The database refuses anything else -- someone who is a
 * guardian at one club and staff at another must not be takeover-able by either.
 */
export async function reissueLogin(scope: Scope, scopeId: string | null, targetUserId: string) {
  const supabase = await createClient();
  const { error: markError } = await supabase.rpc('mark_login_reissued', {
    p_target: targetUserId,
    p_hours: TEMP_PASSWORD_HOURS,
    ...scopeArgs(scope, scopeId),
  });
  if (markError) return { error: friendly(markError) };

  let admin;
  try { admin = serviceClient(); } catch (e) { return { error: (e as Error).message }; }

  const password = newTempPassword();
  const { data, error } = await admin.auth.admin.updateUserById(targetUserId, {
    password,
    ban_duration: 'none',
    app_metadata: { must_change_password: true },
  });
  if (error || !data.user) return { error: error?.message ?? 'Could not reissue the login.' };

  revalidatePath('/', 'layout');
  return { success: true as const, email: data.user.email ?? '', name: (data.user.user_metadata as any)?.name ?? '', password, hours: TEMP_PASSWORD_HOURS };
}

/** Platform admin: reissue by typing the email (there is no per-tenant list to click from). */
export async function reissueLoginByEmail(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!looksLikeEmail(cleanEmail)) return { error: 'Enter a valid email address.' };
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc('can_provision_login', scopeArgs('platform', null));
  if (!allowed) return { error: 'You don’t have permission to do that.' };

  let admin;
  try { admin = serviceClient(); } catch (e) { return { error: (e as Error).message }; }
  const { data: row } = await admin.from('users').select('id').ilike('email', cleanEmail).maybeSingle();
  if (!row) return { error: 'No account with that email.' };
  return reissueLogin('platform', null, row.id);
}
