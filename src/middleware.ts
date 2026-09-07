import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Root-level RBAC gate: direct access to any protected page (including
  // deep links like /clubs/{slug}/teams/{slug}) prompts for login before
  // rendering anything, rather than relying on each page's own
  // `if (!user) redirect('/login')` to catch it individually -- same
  // outcome, enforced once, in one place. Per-club/per-team *role*
  // scoping still happens where it already did (getClubAccess() /
  // getAssignedTeamIds() on each page, backed by RLS) -- this only
  // gates "signed in or not", not "allowed to manage this specific team".
  const PUBLIC_PATHS = ['/login', '/guardian-signup'];
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // /t/* and /platformconsole are rewritten (next.config.js) to the proxied
  // Tournament Manager app, which has its own separate auth model and is
  // reachable by guests -- Club Manager's login gate must not intercept
  // them before the rewrite gets a chance to run.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|t/|platformconsole).*)'],
};
