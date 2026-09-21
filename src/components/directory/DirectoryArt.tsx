'use client';

import { useState } from 'react';
import { crestSpec, crestSvg, type CrestKind } from '@/lib/crest';

/**
 * The generated mark for a club or tournament with no logo. Sized by the
 * caller, drawn by src/lib/crest.ts (the same drawing the seed images use).
 */
export function Crest({
  name,
  seed,
  accent,
  primary,
  kind,
  size,
}: {
  name: string;
  seed: string;
  accent?: string | null;
  primary?: string | null;
  kind: CrestKind;
  size: number;
}) {
  // crestSvg only emits its own tags, validated colors and letters/digits.
  const svg = crestSvg(size, crestSpec({ name, seed, accent, primary, kind }));
  return <span style={{ display: 'inline-flex', lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/**
 * A logo that degrades to the generated crest instead of a broken-image icon.
 * Signed R2 URLs expire and uploaded files can vanish, so "the URL exists" is
 * not the same as "the image loads".
 */
export function LogoOrCrest({
  src,
  alt,
  name,
  seed,
  accent,
  kind,
  size,
}: {
  src: string | null;
  alt: string;
  name: string;
  seed: string;
  accent?: string | null;
  kind: CrestKind;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Crest name={name} seed={seed} accent={accent} kind={kind} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed, expiring URLs of arbitrary size; next/image adds nothing here
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }}
    />
  );
}

export function CourtIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <rect x="6" y="18" width="88" height="64" rx="5" fill="#0F766E" />
      <rect x="6" y="18" width="88" height="64" rx="5" fill="none" stroke="#fff" strokeWidth="2.5" />
      <line x1="50" y1="18" x2="50" y2="82" stroke="#fff" strokeWidth="2.5" />
      <line x1="6" y1="50" x2="94" y2="50" stroke="#fff" strokeWidth="2.5" />
      <rect x="27" y="34" width="46" height="32" fill="none" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}
