import type { SupabaseClient } from '@supabase/supabase-js';
import { getDownloadUrl } from '../../shared/files/lib/r2';

/**
 * The public clubs and tournaments the homepage, /clubs and /tournaments all
 * show. One place for the query, the defensive filtering and the logo
 * resolution, so the three pages can't drift apart.
 */

export type PublicClubTile = {
  slug: string;
  name: string;
  orgName: string;
  location: string | null;
  accent: string | null;
  /** A ready-to-use image URL, or null when the crest should be generated. */
  logoUrl: string | null;
};

export type PublicTournamentCard = {
  slug: string;
  name: string;
  orgSlug: string;
  orgName: string;
  accent: string | null;
  posterUrl: string | null;
  eventDate: string | null;
  venue: string | null;
};

// Long enough that a page a visitor leaves open doesn't lose its images.
const LOGO_URL_TTL_SECONDS = 6 * 60 * 60;

/**
 * club logo, else the org's logo (the club-over-org rule in
 * src/lib/club-branding.ts), else null. A club's own logo is a private R2 key
 * and needs a signed URL; if signing fails (missing credentials, a bad key)
 * the tile just falls back, because a directory page that errors over a logo is
 * worse than one with a generated crest.
 */
async function resolveLogo(row: { logo_key: string | null; org_logo_url: string | null }): Promise<string | null> {
  if (row.logo_key) {
    try {
      return await getDownloadUrl(row.logo_key, LOGO_URL_TTL_SECONDS);
    } catch {
      /* fall through to the org logo */
    }
  }
  return row.org_logo_url && row.org_logo_url.trim() ? row.org_logo_url : null;
}

export async function loadPublicClubs(supabase: SupabaseClient<any, any, any>) {
  const { data, error } = await supabase
    .from('public_clubs')
    .select('slug, name, location, org_name, org_accent, logo_key, org_logo_url')
    .order('name');

  // public_clubs is a view, so PostgREST can't see that the joined columns are
  // NOT NULL at the base-table level. Filter rather than assert: a broken link
  // is worse than a skipped row if that guarantee is ever wrong.
  const rows = (data ?? []).filter((c: any) => !!c.slug && !!c.name && !!c.org_name);
  const clubs: PublicClubTile[] = await Promise.all(
    rows.map(async (c: any) => ({
      slug: c.slug,
      name: c.name,
      orgName: c.org_name,
      location: c.location ?? null,
      accent: c.org_accent ?? null,
      logoUrl: await resolveLogo(c),
    }))
  );
  return { clubs, error: error?.message ?? null };
}

export async function loadPublicTournaments(supabase: SupabaseClient<any, any, any>) {
  const { data, error } = await supabase
    .from('public_tournaments')
    .select('slug, name, poster_url, event_date, venue, org_slug, org_name, org_accent')
    .order('event_date', { ascending: false });

  const tournaments: PublicTournamentCard[] = (data ?? [])
    .filter((t: any) => !!t.slug && !!t.name && !!t.org_slug && !!t.org_name)
    .map((t: any) => ({
      slug: t.slug,
      name: t.name,
      orgSlug: t.org_slug,
      orgName: t.org_name,
      accent: t.org_accent ?? null,
      // poster_url is a public storage URL already; an empty string means none.
      posterUrl: t.poster_url && String(t.poster_url).trim() ? t.poster_url : null,
      eventDate: t.event_date ?? null,
      venue: t.venue ?? null,
    }));
  return { tournaments, error: error?.message ?? null };
}
