import { createClient } from '@/lib/supabase/server';
import OrgAccentTheme from '@/components/OrgAccentTheme';
import LoginForm from './LoginForm';

// redirectTo comes from middleware.ts, set whenever a direct link to a protected page
// gated sign-in first. Matched only against these two known-safe shapes -- the captured
// groups feed a parameterized query/RPC arg, never a raw string, so there's nothing to
// sanitize beyond "does it look like one of these paths at all".
const TM_CONSOLE = /^\/tm\/([a-z0-9-]+)\/([a-z0-9-]+)/;
const ENTRY_PORTAL = /^\/entry\/([0-9a-fA-F-]{36})/;

type Background = { posterUrl: string | null; accent: string | null };

/**
 * Which tournament (if any) this sign-in is "for", so the screen can show its poster and
 * accent before anyone has authenticated -- the request was specifically "starting with
 * the login screen". Two shapes:
 *
 *  - /tm/<org>/<tournament> (the organizer console): read through public_tournaments,
 *    the same anon-safe view the public directory already uses -- so this only shows a
 *    background for a tournament its own owner chose to list. Nothing new is exposed.
 *  - /entry/<id> (the entrant portal): the entry itself is never public, so this goes
 *    through entry_login_background() (phase16b) -- a narrow, DELIBERATELY anon-readable
 *    function that returns only a tournament's name/poster/accent for a given entry id,
 *    nothing about the entry. See CLAUDE.md §0w/§0x for why that's an acceptable, tracked
 *    exception rather than a silent one.
 */
async function resolveBackground(redirectTo: string | undefined): Promise<Background | null> {
  if (!redirectTo) return null;
  const supabase = await createClient();

  const tm = TM_CONSOLE.exec(redirectTo);
  if (tm) {
    const [, orgSlug, tournamentSlug] = tm;
    const { data } = await supabase
      .from('public_tournaments')
      .select('poster_url, org_accent')
      .eq('org_slug', orgSlug)
      .eq('slug', tournamentSlug)
      .maybeSingle();
    return data ? { posterUrl: data.poster_url || null, accent: data.org_accent || null } : null;
  }

  const entry = ENTRY_PORTAL.exec(redirectTo);
  if (entry) {
    const { data } = await (supabase as any).rpc('entry_login_background', { p_entry_id: entry[1] });
    const row = data?.[0];
    return row ? { posterUrl: row.poster_url || null, accent: row.accent || null } : null;
  }

  return null;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirectTo?: string }> }) {
  const { redirectTo } = await searchParams;
  const background = await resolveBackground(redirectTo);

  return (
    <OrgAccentTheme accent={background?.accent ?? null}>
      <LoginForm posterUrl={background?.posterUrl ?? null} />
    </OrgAccentTheme>
  );
}
