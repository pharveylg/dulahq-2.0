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
type LoginContext = { background: Background | null; destination: string | null };

/**
 * What this sign-in is "for" -- both the tournament background (the original ask,
 * "starting with the login screen") and a plain-English destination label, added because
 * /login and /login?redirectTo=/platformconsole otherwise render identically and a person
 * landing here mid-task has no idea why they were stopped or where they'll end up. `null`
 * only when there's no redirectTo at all, so the bare /login page is untouched.
 *
 *  - /tm/<org>/<tournament> (the organizer console): read through public_tournaments,
 *    the same anon-safe view the public directory already uses -- so this only shows a
 *    background/name for a tournament its own owner chose to list. Nothing new is exposed.
 *  - /entry/<id> (the entrant portal): the entry itself is never public, so this goes
 *    through entry_login_background() (phase16b) -- a narrow, DELIBERATELY anon-readable
 *    function that returns only a tournament's name/poster/accent for a given entry id,
 *    nothing about the entry. See CLAUDE.md §0w/§0x for why that's an acceptable, tracked
 *    exception rather than a silent one.
 *  - Everything else gated by middleware.ts gets a generic, hardcoded label -- no lookup,
 *    since none of those paths carry public-safe identifying data worth a query.
 */
async function resolveContext(redirectTo: string | undefined): Promise<LoginContext> {
  if (!redirectTo) return { background: null, destination: null };
  const supabase = await createClient();

  const tm = TM_CONSOLE.exec(redirectTo);
  if (tm) {
    const [, orgSlug, tournamentSlug] = tm;
    const { data } = await supabase
      .from('public_tournaments')
      .select('name, poster_url, org_accent')
      .eq('org_slug', orgSlug)
      .eq('slug', tournamentSlug)
      .maybeSingle();
    return {
      background: data ? { posterUrl: data.poster_url || null, accent: data.org_accent || null } : null,
      destination: data?.name ? `${data.name}’s tournament console` : 'the tournament console',
    };
  }

  const entry = ENTRY_PORTAL.exec(redirectTo);
  if (entry) {
    const { data } = await (supabase as any).rpc('entry_login_background', { p_entry_id: entry[1] });
    const row = data?.[0];
    return {
      background: row ? { posterUrl: row.poster_url || null, accent: row.accent || null } : null,
      destination: row?.tournament_name ? `your team’s entry for ${row.tournament_name}` : 'your team’s tournament entry',
    };
  }

  if (redirectTo.startsWith('/platformconsole')) return { background: null, destination: 'the platform console' };
  if (redirectTo.startsWith('/guardian')) return { background: null, destination: 'your guardian account' };
  if (redirectTo.startsWith('/player')) return { background: null, destination: 'your player profile' };
  if (redirectTo.startsWith('/clubs/new')) return { background: null, destination: 'creating a new club' };
  if (redirectTo.startsWith('/c/')) return { background: null, destination: 'the club console' };

  return { background: null, destination: 'where you left off' };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirectTo?: string }> }) {
  const { redirectTo } = await searchParams;
  const { background, destination } = await resolveContext(redirectTo);

  return (
    <OrgAccentTheme accent={background?.accent ?? null}>
      <LoginForm posterUrl={background?.posterUrl ?? null} destination={destination} />
    </OrgAccentTheme>
  );
}
