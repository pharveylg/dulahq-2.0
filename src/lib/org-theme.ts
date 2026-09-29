// Turns one org accent color (organizations.accent, a free-typed #RRGGBB the platform
// console already lets an admin set -- Directory.tsx) into the small set of variants
// globals.css itself needs: a hover shade, soft tints for both themes, and a text color
// that stays readable on the accent whatever hue was picked. Pure and dependency-free
// (same discipline as crest.ts) so it can render identically on the server and be
// unit-tested directly, no DOM or canvas involved.
//
// Deliberately NOT a copy of --accent's own light/dark split in globals.css: that system
// keeps --accent and --accent-hover IDENTICAL in both themes and only retints the soft
// pair, because the single hardcoded green already reads fine on both a white and a near-
// black surface. An arbitrary org color can't assume that -- a pale yellow or a deep navy
// needs its own light/dark soft tints derived the same way emerald's were, which is what
// this does generically instead of by hand per org.

export const DEFAULT_ACCENT = '#059669';

export type OrgAccentPalette = {
  accent: string;
  accentHover: string;
  onAccent: string;
  accentSoftLight: string;
  accentSoftBorderLight: string;
  accentSoftDark: string;
  accentSoftBorderDark: string;
};

export function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
}

type Hsl = { h: number; s: number; l: number };

function rgbToHsl(r: number, g: number, b: number): Hsl {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4;
  }
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [hue(h / 360 + 1 / 3) * 255, hue(h / 360) * 255, hue(h / 360 - 1 / 3) * 255];
}

const hslHex = (h: Hsl) => rgbToHex(...hslToRgb(h));

/** WCAG relative luminance -- decides whether white or dark text sits on the accent. */
function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function deriveOrgAccentPalette(rawAccent: string | null | undefined): OrgAccentPalette {
  const accent = isValidHexColor(rawAccent) ? rawAccent : DEFAULT_ACCENT;
  const [r, g, b] = hexToRgb(accent);
  const hsl = rgbToHsl(r, g, b);

  const onAccent = relativeLuminance(r, g, b) > 0.42 ? '#0F172A' : '#FFFFFF';
  const accentHover = hslHex({ h: hsl.h, s: hsl.s, l: Math.max(hsl.l - 10, 8) });
  const accentSoftLight = hslHex({ h: hsl.h, s: Math.min(hsl.s, 70), l: 95 });
  const accentSoftBorderLight = hslHex({ h: hsl.h, s: Math.min(hsl.s, 80), l: 84 });
  const accentSoftDark = hslHex({ h: hsl.h, s: Math.max(Math.min(hsl.s, 70), 25), l: 16 });
  const accentSoftBorderDark = hslHex({ h: hsl.h, s: Math.max(Math.min(hsl.s, 75), 25), l: 26 });

  return { accent, accentHover, onAccent, accentSoftLight, accentSoftBorderLight, accentSoftDark, accentSoftBorderDark };
}
