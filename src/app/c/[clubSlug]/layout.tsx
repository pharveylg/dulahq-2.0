import { createClient } from '@/lib/supabase/server';
import OrgAccentTheme from '@/components/OrgAccentTheme';

/**
 * Retints this club's whole page tree with its own org's accent (§0v proposal follow-up:
 * "apply the org's accent as a dominant color scheme"). Scoped to club pages only, not
 * the whole signed-in app -- a coach or guardian who belongs to more than one org sees
 * each club's own color on that club's pages, never one "primary" org bleeding onto
 * another's (confirmed as the wanted behavior before building this).
 *
 * Reads `clubs.org_id` -> `organizations.accent` through the normal RLS-respecting
 * client, the same one every page under this route already uses -- `clubs_member_read`
 * covers staff of any listing status, and the public listed-club policy covers a guest
 * on a public club page, so both get themed; a private club a guest can't see returns no
 * row and this quietly renders unthemed, leaving the page's own sign-in prompt untouched.
 */
export default async function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const supabase = await createClient();
  const { data: club } = await supabase
    .from('clubs')
    .select('organizations(accent)')
    .eq('slug', clubSlug)
    .maybeSingle();

  const accent = (club?.organizations as unknown as { accent: string | null } | null)?.accent ?? null;
  return <OrgAccentTheme accent={accent}>{children}</OrgAccentTheme>;
}
