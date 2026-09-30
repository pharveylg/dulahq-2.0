/**
 * The four showcase orgs scripts/seed-showcase-demo.mjs creates (see
 * docs/demo-data-showcase.md) -- pure, dependency-free, same discipline as
 * src/lib/demo-personas.ts's own DEMO_EMAIL_DOMAIN check. Used to tag their
 * clubs and tournaments "(demo)" wherever the public directory lists them,
 * so a prospect browsing the homepage can tell showcase data from a real
 * org's own listing (e.g. OLLES, which is not one of these four).
 */
export const DEMO_ORG_SLUGS = ['usna-gali', 'cdo-ysc', 'pilipinas-futbol', 'davao-unity-sports'] as const;

export function isDemoOrgSlug(slug: string | null | undefined): boolean {
  return !!slug && (DEMO_ORG_SLUGS as readonly string[]).includes(slug);
}
