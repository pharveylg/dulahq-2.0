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

/**
 * Whether the signed-in session is a platform admin (public.platform_admins),
 * the org-system's own concept of "admin" -- separate from and not
 * necessarily equal to public.users.role === 'admin' (see the note in
 * getCurrentDulaUser above: those are two different identity paths that
 * happen to currently agree for the one account that exists).
 *
 * Querying platform_admins directly (rather than a users.role check) works
 * safely even though its own RLS policy also gates on is_platform_admin():
 * for a non-admin caller RLS filters the row set to empty (not an error),
 * which is exactly the "false" case we want; for an admin caller their own
 * row comes back.
 */
export async function isPlatformAdmin() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return false;

  const { data } = await supabase
    .from('platform_admins')
    .select('email')
    .ilike('email', authUser.email)
    .maybeSingle();

  return !!data;
}

/**
 * Organizations the signed-in session can create a club for: every org if
 * they're a platform admin, or the orgs where org_members has them as
 * role='admin' otherwise. Used to gate + populate the "New club" org
 * picker -- mirrors the DB-side is_org_admin()/is_platform_admin() OR
 * that clubs' insert RLS policy actually enforces, so the UI doesn't show
 * an org the insert would then reject.
 */
export async function getClubCreatableOrgs() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return [];

  if (await isPlatformAdmin()) {
    const { data } = await supabase
      .from('organizations')
      .select('id, name')
      .order('name');
    return data ?? [];
  }

  const { data } = await supabase
    .from('org_members')
    .select('org_id, role, organizations(id, name)')
    .eq('role', 'admin')
    .ilike('email', authUser.email);

  return (data ?? [])
    .map((m: any) => m.organizations)
    .filter(Boolean);
}
