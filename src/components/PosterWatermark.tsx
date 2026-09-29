/**
 * A tournament's poster, faded into the page's own background -- the login screen's own
 * request ("poster as a watermark background... starting with the login screen"), built
 * generically enough to drop behind any tournament-scoped page later. Purely decorative:
 * no pointer events, and it renders nothing at all when there's no poster to show, so a
 * tournament that never uploaded one (§0v/§0o) doesn't leave an empty gap or a broken
 * image behind the content.
 */
export default function PosterWatermark({ url }: { url: string | null | undefined }) {
  if (!url) return null;
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative background, not content; next/image's remote-domain allowlist would need the Supabase Storage host wired in just for this */}
      <img
        src={url}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center 20%',
          opacity: 0.16,
          filter: 'blur(2px) saturate(1.15)',
          transform: 'scale(1.08)',
        }}
      />
      {/* Vignette in the page's own background color -- keeps text readable over any
          poster's own colors/contrast, and fades identically in light or dark theme
          since var(--bg) already flips between them. */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 0%, var(--bg) 88%)' }} />
    </div>
  );
}
