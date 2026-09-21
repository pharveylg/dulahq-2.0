/**
 * Generated crests: the mark a club or tournament shows when nobody has
 * uploaded a logo, and the source for the seed images
 * (scripts/seed-directory-art.mjs). One module on purpose -- the React
 * fallback and the seeded PNGs are then the same drawing, so a club looks the
 * same whether its crest was generated on the fly or rendered once and stored.
 *
 * Pure and dependency-free, and limited to syntax Node can strip
 * (no enums, no path aliases) so the seed script can import it directly.
 *
 * Everything that reaches the SVG string is either a fixed constant, a
 * validated hex color, or initials filtered to letters and digits. A club's
 * name is user input and this string is injected as markup, so nothing else
 * is allowed through.
 */

export type CrestKind = 'club' | 'tournament';
export type CrestShape = 'shield' | 'round' | 'hex';
export type CrestPattern = 'plain' | 'star' | 'underline';
export type CrestSpec = { shape: CrestShape; primary: string; secondary: string; text: string; pattern: CrestPattern };

const DEFAULT_ACCENT = '#059669';
// Clubs alternate between a shield and a roundel; tournaments always get the
// hexagon, so the two kinds are told apart on sight even at thumbnail size.
const CLUB_SHAPES: CrestShape[] = ['shield', 'round'];
const SECONDARIES = ['#F5C518', '#FFFFFF', '#7DD3FC', '#F59E0B', '#FDE68A', '#A7F3D0'];
// A third thing to vary on. Two clubs of one org share initials and the org's
// accent (Unsa Gali FC, Usna Gali FC), and shape plus fill alone leave a real
// chance of two tiles that look like the same crest drawn twice.
const PATTERNS: CrestPattern[] = ['plain', 'star', 'underline'];
const STAR_POINTS = Array.from({ length: 10 }, (_, i) => {
  const radius = i % 2 === 0 ? 8 : 3.3;
  const angle = ((-90 + i * 36) * Math.PI) / 180;
  return (50 + radius * Math.cos(angle)).toFixed(2) + ',' + (25 + radius * Math.sin(angle)).toFixed(2);
}).join(' ');
// Trailing words that say what the club is, not who it is: "Unsa Gali FC" is UG.
const SUFFIX_WORDS = new Set(['FC', 'SC', 'CF', 'AFC', 'FA', 'CLUB']);

const HEX = /^#[0-9a-fA-F]{6}$/;

/** FNV-1a: small, stable across runtimes, and good enough to pick a shape and a color. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function safeAccent(color: string | null | undefined): string {
  return color && HEX.test(color) ? color : DEFAULT_ACCENT;
}

/** Multiplies each channel by `factor` (0-1). Expects a validated #RRGGBB. */
export function darkenHex(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift: number) =>
    Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * factor))).toString(16).padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`.toUpperCase();
}

/**
 * Up to three letters. A leading all-caps word of 2-4 letters is already an
 * acronym ("CDO FC" -> CDO); otherwise the first letters of the first two
 * words that aren't a club suffix ("Misamis Oriental Footballers" -> MO).
 */
export function initialsFor(name: string): string {
  const words = name.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  if (words.length === 0) return 'DH';
  const first = words[0];
  if (/^[\p{Lu}\p{N}]{2,4}$/u.test(first)) return first.slice(0, 3).toUpperCase();
  const meaningful = words.filter((w) => !SUFFIX_WORDS.has(w.toUpperCase()));
  const picked = (meaningful.length ? meaningful : words).slice(0, 2);
  return picked.map((w) => Array.from(w)[0]).join('').toUpperCase();
}

/**
 * `seed` should be something unique and stable per subject (its slug), so two
 * subjects with the same initials and the same org accent -- "Unsa Gali FC"
 * and "Usna Gali FC" -- still come out looking different.
 */
export function crestSpec(input: {
  name: string;
  seed: string;
  accent?: string | null;
  kind: CrestKind;
  /** Force the fill (validated like any color). For a crest sitting on a colored ground. */
  primary?: string | null;
}): CrestSpec {
  const h = hashString(`${input.kind}:${input.seed}`);
  const accent = safeAccent(input.accent);
  return {
    shape: input.kind === 'tournament' ? 'hex' : CLUB_SHAPES[h % CLUB_SHAPES.length],
    primary: input.primary && HEX.test(input.primary) ? input.primary : (h >>> 7) % 2 === 0 ? accent : darkenHex(accent, 0.7),
    secondary: SECONDARIES[(h >>> 3) % SECONDARIES.length],
    text: initialsFor(input.name),
    pattern: PATTERNS[(h >>> 11) % PATTERNS.length],
  };
}

/** The crest as a standalone SVG document string (also valid inline in HTML). */
export function crestSvg(size: number, spec: CrestSpec): string {
  const { shape, primary, secondary, text, pattern } = spec;
  let body: string;
  if (shape === 'round') {
    body =
      `<circle cx="50" cy="50" r="46" fill="${primary}"/>` +
      `<circle cx="50" cy="50" r="38" fill="none" stroke="${secondary}" stroke-width="3"/>`;
  } else if (shape === 'hex') {
    body =
      `<polygon points="50,4 91,27 91,73 50,96 9,73 9,27" fill="${primary}"/>` +
      `<polygon points="50,14 82,32 82,68 50,86 18,68 18,32" fill="none" stroke="${secondary}" stroke-width="3"/>`;
  } else {
    body =
      `<path d="M50 4 L90 16 V50 C90 74 72 90 50 98 C28 90 10 74 10 50 V16 Z" fill="${primary}"/>` +
      `<path d="M50 12 L82 21 V50 C82 69 67 82 50 89 C33 82 18 69 18 50 V21 Z" fill="none" stroke="${secondary}" stroke-width="3"/>`;
  }
  const long = text.length > 2;
  const mark =
    pattern === 'star'
      ? '<polygon points="' + STAR_POINTS + '" fill="' + secondary + '"/>'
      : pattern === 'underline'
        ? '<rect x="33" y="' + (long ? 66 : 70) + '" width="34" height="3.5" rx="1.5" fill="' + secondary + '"/>'
        : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">` +
    body +
    mark +
    `<text x="50" y="${long ? 57 : 61}" text-anchor="middle" font-family="Oswald, 'Arial Narrow', Arial, sans-serif" font-weight="700" font-size="${long ? 27 : 36}" fill="#FFFFFF">${text}</text>` +
    `</svg>`
  );
}
