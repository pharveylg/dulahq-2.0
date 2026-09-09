/**
 * Gap analysis P0-6 ("Club branding vs. org branding is undefined"). Two
 * distinct branding sources exist -- `organizations.logo_url`/`accent`
 * (used today only by the platform-admin org directory) and
 * `clubs.branding` (a jsonb bag, `{}` everywhere until this phase, with
 * nowhere to set it). The showcase data already has two orgs each owning
 * two clubs, so "the org has a logo, the club has none, which one prints on
 * a roster export" was never a hypothetical.
 *
 * The rule, established here rather than left to whichever consumer builds
 * a renderer first: a club's own branding overrides the org's when both
 * exist; falls back to the org's otherwise. A club is the more specific
 * identity a person is actually looking at (a roster, a fee receipt, a
 * club-scoped export) -- the org is the tenant that owns it, not what's on
 * the page.
 *
 * Nothing renders through this yet except the club console's own header
 * (ClubDetailPage). RosterBuilder's TXT export stays text-only on purpose --
 * a plain-text file has nowhere to put an image -- so this precedence rule
 * has no export to retrofit into until a richer export format exists.
 */

export type ClubBranding = {
  /** R2 storage key (shared/files/lib/r2), not a public URL -- objects
   *  aren't public, so a signed URL is generated per-request. */
  logoKey?: string;
};

export function parseClubBranding(raw: unknown): ClubBranding {
  if (!raw || typeof raw !== 'object') return {};
  const b = raw as Record<string, unknown>;
  return typeof b.logoKey === 'string' ? { logoKey: b.logoKey } : {};
}

export function resolveLogoKey(
  club: { branding?: unknown } | null | undefined,
  org: { logo_url?: string | null } | null | undefined
): { source: 'club' | 'org' | null; logoKey: string | null; orgLogoUrl: string | null } {
  const clubLogoKey = parseClubBranding(club?.branding).logoKey ?? null;
  if (clubLogoKey) return { source: 'club', logoKey: clubLogoKey, orgLogoUrl: null };
  if (org?.logo_url) return { source: 'org', logoKey: null, orgLogoUrl: org.logo_url };
  return { source: null, logoKey: null, orgLogoUrl: null };
}
