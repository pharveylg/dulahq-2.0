import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component -- middleware handles
            // session refresh in that case, safe to ignore here.
          }
        },
      },
    }
  );
}

/**
 * This project's identity model is NOT auth.uid()-based -- public.users
 * has no relationship to auth.users at all. The whole app (existing
 * Tournament Manager RLS included) resolves "who is this" by matching
 * the signed-in session's email against public.users.email. This helper
 * is the app-code equivalent of the current_dula_user_id() SQL function,
 * for places that need the current user's row (not just relying on RLS
 * to filter automatically, which it already does for query results).
 *
 * Returns null if there's no session, or if the session's email has no
 * matching public.users row (e.g. an auth account exists but nobody
 * has been added to public.users yet -- this app doesn't build user
 * signup/provisioning, it assumes accounts are already set up the way
 * the existing Tournament Manager app already manages them).
 */
export async function getCurrentDulaUser() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return null;

  const { data: dulaUser } = await supabase
    .from('users')
    .select('id, name, email, role')
    .eq('email', authUser.email)
    .maybeSingle();

  return dulaUser;
}
