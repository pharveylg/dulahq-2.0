'use server';

import { serviceClient } from '@/lib/admin-auth';
import { appOrigin } from '@/lib/app-url';
import { sendEmail, renderEmailHtml } from '@/lib/email';
import { looksLikeEmail } from '@/lib/temp-password';

/**
 * No Supabase dashboard SMTP configuration needed: generateLink() only issues
 * the recovery token (service role, never reaches the browser), and the
 * actual email -- with its own From address, branding, and link entirely on
 * dulahq.app -- is sent by this app via Resend, not by Supabase's own
 * (rate-limited, unbranded) built-in mailer. The link uses a token_hash
 * pointed at /auth/confirm rather than Supabase's own action_link, so nothing
 * in the user's browser ever shows a supabase.co URL.
 *
 * Always returns the same generic message whether or not the email matched
 * an account -- the alternative (a distinct "no account with that email")
 * lets anyone enumerate which addresses have logins.
 */
const GENERIC_RESULT = {
  success: true as const,
  message: 'If an account exists for that email, a reset link is on its way.',
};

export async function requestPasswordReset(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!looksLikeEmail(cleanEmail)) return { error: 'Enter a valid email address.' };

  let admin;
  try {
    admin = serviceClient();
  } catch {
    // Service role isn't configured on this deployment -- fail generically
    // rather than telling an anonymous caller why.
    return GENERIC_RESULT;
  }

  const origin = await appOrigin();
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: cleanEmail,
    options: { redirectTo: `${origin}/reset-password` },
  });

  if (error || !data?.properties?.hashed_token) {
    if (error && !/not.*found|no.*user/i.test(error.message)) {
      console.error('generateLink (recovery) failed', error);
    }
    return GENERIC_RESULT;
  }

  const resetUrl = `${origin}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/reset-password`;

  await sendEmail({
    to: cleanEmail,
    subject: 'Reset your Dulà HQ password',
    html: renderEmailHtml({
      title: 'Reset your password',
      bodyHtml: 'Someone (hopefully you) asked to reset the password on this Dulà HQ account. ' +
        'This link works once and expires soon — if you didn’t request this, you can ignore it.',
      ctaText: 'Choose a new password',
      ctaUrl: resetUrl,
    }),
    text: `Reset your Dulà HQ password: ${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
  });

  return GENERIC_RESULT;
}
