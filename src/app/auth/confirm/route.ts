import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Lands an emailed verification link entirely on dulahq.app -- generateLink()
 * (forgot-password/actions.ts) hands back a token_hash rather than Supabase's
 * own action_link, so this is the first thing the browser ever hits, not a
 * supabase.co URL that then bounces here. Standard Supabase/Next.js App
 * Router pattern: verifyOtp with a token_hash works regardless of whether the
 * project is otherwise configured for PKCE or implicit flow email links.
 *
 * Deliberately generic over `type`, not recovery-only -- the same route
 * works for any future token_hash-based email verification this app adds,
 * without needing its own copy of this handler.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/';

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const failureUrl = new URL('/login', origin);
  failureUrl.searchParams.set('error', 'That link has expired or was already used.');
  return NextResponse.redirect(failureUrl);
}
