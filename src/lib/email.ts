import 'server-only';

/**
 * Transactional email via Resend's HTTP API, called directly with fetch rather
 * than their SDK -- matching this codebase's existing preference for a
 * provider's REST API over a thicker wrapper dependency (web-push, the
 * S3-compatible R2 client). Needs RESEND_API_KEY and EMAIL_FROM in the
 * environment; a verified sending domain on Resend (so EMAIL_FROM is e.g.
 * "Dulà HQ <no-reply@dulahq.app>", not their onboarding/testing address) is
 * what keeps the From address, body and links entirely on dulahq.app -- see
 * CLAUDE.md §8 for the domain-verification tradeoffs this was chosen for.
 *
 * Best-effort: never throws. A misconfigured or momentarily-down provider
 * should degrade (logged server-side, caller decides what if anything to
 * tell the user) rather than crash the server action riding alongside it --
 * same principle notify.ts's push dispatch already uses.
 *
 * The template helpers (escapeHtml, renderEmailHtml) live in email-template.ts,
 * a pure dependency-free module -- this file re-exports them so callers only
 * need one import, but keeps them out of this file because it imports
 * 'server-only', which can't be pulled into a Vitest unit test.
 */
export { escapeHtml, renderEmailHtml } from './email-template';

const RESEND_API_URL = 'https://api.resend.com/emails';

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.error('Email is not configured: set RESEND_API_KEY and EMAIL_FROM.');
    return { sent: false };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!response.ok) {
      console.error('Email send failed', response.status, await response.text().catch(() => ''));
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error('Email send failed', error);
    return { sent: false };
  }
}
