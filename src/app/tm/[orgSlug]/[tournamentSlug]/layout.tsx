import { createClient } from '@/lib/supabase/server';
import OrgAccentTheme from '@/components/OrgAccentTheme';

/**
 * Retints the organizer console with its own host org's accent, same reasoning and
 * scoping as the club layout (§0v). Unlike a club page, `/tm/...` is never public --
 * every page under it already requires a signed-in organizer/org admin/tournament staff
 * member and 404s otherwise -- so there's no guest-vs-staff branch to worry about here:
 * this either finds the org (anyone who can reach this route can also read
 * `organizations` via `orgs_public_read`) or renders unthemed if the org somehow can't be
 * resolved, and the page underneath still enforces its own access on its own terms.
 */
export default async function TournamentConsoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  const { data: org } = await supabase.from('organizations').select('accent').eq('slug', orgSlug).maybeSingle();
  return <OrgAccentTheme accent={org?.accent ?? null}>{children}</OrgAccentTheme>;
}
