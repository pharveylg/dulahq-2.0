import { deriveOrgAccentPalette } from '@/lib/org-theme';

/**
 * Retints the page content beneath it with one org's own accent color -- scoped to this
 * subtree only, never the persistent top nav (a sibling in the root layout, outside any
 * CSS variable this sets, on purpose: the nav stays Dulà HQ's own brand chrome; the
 * workspace below it becomes the org's).
 *
 * A plain <style> + class pair rather than an inline `style` attribute, because the dark
 * theme needs its OWN tint for --accent-soft/--accent-soft-border (globals.css does the
 * same split at :root -- an org's accent can't assume one pale tint works on both a white
 * and a near-black surface the way the hardcoded default does). The selector
 * `:root[data-theme="dark"] .scope` reads the theme off <html> regardless of where this
 * div sits in the tree, so it tracks the theme toggle with no client JS of its own.
 */
export default function OrgAccentTheme({ accent, children }: { accent: string | null | undefined; children: React.ReactNode }) {
  const p = deriveOrgAccentPalette(accent);
  return (
    <>
      <style>{`
.org-accent-scope {
  --accent: ${p.accent};
  --accent-2: ${p.accent};
  /* --accent-gradient's computed value is fixed wherever it's declared (only :root,
     otherwise) and inherits as that already-resolved color, NOT as a live var(--accent)
     reference -- redeclaring it here is what makes it pick up THIS scope's --accent. */
  --accent-gradient: var(--accent);
  --accent-hover: ${p.accentHover};
  --on-accent: ${p.onAccent};
  --accent-soft: ${p.accentSoftLight};
  --accent-soft-border: ${p.accentSoftBorderLight};
}
:root[data-theme="dark"] .org-accent-scope {
  --accent-soft: ${p.accentSoftDark};
  --accent-soft-border: ${p.accentSoftBorderDark};
}
`}</style>
      <div className="org-accent-scope">{children}</div>
    </>
  );
}
