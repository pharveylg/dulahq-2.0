import { describe, it, expect } from 'vitest';
import { deriveOrgAccentPalette, isValidHexColor, DEFAULT_ACCENT } from '../../src/lib/org-theme';

describe('isValidHexColor', () => {
  it('accepts a proper #RRGGBB string', () => {
    expect(isValidHexColor('#059669')).toBe(true);
    expect(isValidHexColor('#ABCDEF')).toBe(true);
  });
  it('rejects everything else', () => {
    expect(isValidHexColor('059669')).toBe(false);
    expect(isValidHexColor('#0596')).toBe(false);
    expect(isValidHexColor('#GGGGGG')).toBe(false);
    expect(isValidHexColor(null)).toBe(false);
    expect(isValidHexColor(undefined)).toBe(false);
    expect(isValidHexColor(123)).toBe(false);
    // the injection case: an org's own free-typed accent field is the input here
    expect(isValidHexColor('<script>alert(1)</script>')).toBe(false);
  });
});

describe('deriveOrgAccentPalette', () => {
  it('falls back to the default accent for missing or invalid input', () => {
    expect(deriveOrgAccentPalette(null).accent).toBe(DEFAULT_ACCENT);
    expect(deriveOrgAccentPalette(undefined).accent).toBe(DEFAULT_ACCENT);
    expect(deriveOrgAccentPalette('not-a-color').accent).toBe(DEFAULT_ACCENT);
    expect(deriveOrgAccentPalette('').accent).toBe(DEFAULT_ACCENT);
  });

  it('keeps a valid accent exactly as given', () => {
    expect(deriveOrgAccentPalette('#1D4ED8').accent).toBe('#1D4ED8');
  });

  it('every derived value is a valid hex color', () => {
    for (const input of ['#059669', '#1D4ED8', '#DC2626', '#FDE047', '#111827', '#FFFFFF', '#000000']) {
      const p = deriveOrgAccentPalette(input);
      for (const key of ['accent', 'accentHover', 'onAccent', 'accentSoftLight', 'accentSoftBorderLight', 'accentSoftDark', 'accentSoftBorderDark'] as const) {
        expect(isValidHexColor(p[key]), `${key} for ${input}`).toBe(true);
      }
    }
  });

  it('picks dark text for a pale accent and white text for a dark, saturated one', () => {
    expect(deriveOrgAccentPalette('#FDE047').onAccent).toBe('#0F172A'); // pale yellow
    expect(deriveOrgAccentPalette('#111827').onAccent).toBe('#FFFFFF'); // near-black slate
    expect(deriveOrgAccentPalette('#DC2626').onAccent).toBe('#FFFFFF'); // saturated red
  });

  it('the hover shade is always darker (or no lighter) than the accent itself', () => {
    for (const input of ['#059669', '#1D4ED8', '#FDE047', '#DC2626']) {
      const p = deriveOrgAccentPalette(input);
      const l = (hex: string) => {
        const n = parseInt(hex.slice(1), 16);
        const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      expect(l(p.accentHover)).toBeLessThanOrEqual(l(p.accent) + 1); // +1 tolerance for rounding
    }
  });

  it('the light-theme soft tint is lighter than the dark-theme one, for the same accent', () => {
    const p = deriveOrgAccentPalette('#1D4ED8');
    const l = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    expect(l(p.accentSoftLight)).toBeGreaterThan(l(p.accentSoftDark));
    expect(l(p.accentSoftBorderLight)).toBeGreaterThan(l(p.accentSoftBorderDark));
  });

  it('is deterministic', () => {
    expect(deriveOrgAccentPalette('#7C3AED')).toEqual(deriveOrgAccentPalette('#7C3AED'));
  });

  it('is case-insensitive on the input hex', () => {
    expect(deriveOrgAccentPalette('#7c3aed').accentHover).toBe(deriveOrgAccentPalette('#7C3AED').accentHover);
  });
});
