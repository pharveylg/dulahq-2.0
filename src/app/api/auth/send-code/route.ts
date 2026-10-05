import { NextResponse, type NextRequest } from 'next/server';
import { serviceClient } from '@/lib/admin-auth';
import { sendEmail, renderEmailHtml, escapeHtml } from '@/lib/email';
import { looksLikeEmail } from '@/lib/temp-password';

/**
 * Emails a 6-digit sign-in code for an EXISTING account, sent through Resend.
 *
 * generateLink({ type: 'magiclink' }) would create an account for an unknown
 * address, so the account check below must run first: an unknown email gets
 * the same success response and nothing is generated or sent.
 *
 * The Tournament Manager app (dula-hq.vercel.app) calls this cross-origin, so
 * only the origins listed in SIGN_IN_ORIGINS get CORS headers.
 */

const ALLOWED_ORIGINS = (process.env.SIGN_IN_ORIGINS ?? 'https://dula-hq.vercel.app,https://dulahq.app')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request.headers.get('origin'));
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!looksLikeEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400, headers });
  }

  const ok = () => NextResponse.json({ ok: true }, { headers });

  let admin;
  try {
    admin = serviceClient();
  } catch {
    return ok();
  }

  const { data: existing } = await admin.from('users').select('id').ilike('email', email).maybeSingle();
  if (!existing) return ok();

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const code = data?.properties?.email_otp;
  if (error || !code) {
    console.error('generateLink (magiclink) failed', error);
    return ok();
  }

  await sendEmail({
    template: 'sign_in_code',
    to: email,
    subject: `${code} is your Dulà HQ sign-in code`,
    html: renderEmailHtml({
      title: 'Your sign-in code',
      bodyHtml: `Enter this code in the sign-in window to continue. It expires soon and works once:` +
        `<p style="font-size:28px;letter-spacing:.2em;font-weight:700;margin:16px 0;color:#14241a;">${escapeHtml(code)}</p>` +
        'If you didn’t try to sign in, you can ignore this email.',
      ctaText: 'Open Dulà HQ',
      ctaUrl: 'https://dulahq.app',
    }),
    text: `Your Dulà HQ sign-in code is ${code}. It expires soon and works once. If you didn't try to sign in, ignore this email.`,
  });

  return ok();
}
