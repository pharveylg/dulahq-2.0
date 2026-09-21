import { describe, it, expect } from 'vitest';
import { crestSpec, crestSvg, initialsFor, safeAccent, hashString } from '../../src/lib/crest';

describe('initialsFor', () => {
  it('keeps a leading acronym', () => {
    expect(initialsFor('CDO FC')).toBe('CDO');
  });
  it('takes the first letters of the first two meaningful words', () => {
    expect(initialsFor('Misamis Oriental Footballers')).toBe('MO');
    expect(initialsFor('National Team Qualifiers')).toBe('NT');
    expect(initialsFor('Copa Gali')).toBe('CG');
  });
  it('does not count a club suffix as a word', () => {
    expect(initialsFor('Unsa Gali FC')).toBe('UG');
    expect(initialsFor('Usna Gali FC')).toBe('UG');
  });
  it('copes with a single word, punctuation, and nothing usable', () => {
    expect(initialsFor('Arsenal')).toBe('A');
    expect(initialsFor("St. Mary's  Juniors")).toBe('SM');
    expect(initialsFor('!!! ---')).toBe('DH');
    expect(initialsFor('')).toBe('DH');
  });
});

describe('crestSpec', () => {
  it('is deterministic for the same subject', () => {
    const a = crestSpec({ name: 'CDO FC', seed: 'cdo-fc', accent: '#2563EB', kind: 'club' });
    const b = crestSpec({ name: 'CDO FC', seed: 'cdo-fc', accent: '#2563EB', kind: 'club' });
    expect(a).toEqual(b);
  });

  it('gives tournaments the hexagon and clubs a shield or roundel', () => {
    expect(crestSpec({ name: 'Tiger Cup', seed: 'tiger-cup', kind: 'tournament' }).shape).toBe('hex');
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      expect(['shield', 'round']).toContain(crestSpec({ name: 'X', seed, kind: 'club' }).shape);
    }
  });

  it('tells apart the seeded subjects that share initials and an org accent', () => {
    // The two Gali clubs share initials (UG) and the Usna Gali accent; the two
    // Tiger Cups share a name. If these collided, two tiles would look identical.
    const club = (slug: string, name: string, accent: string) => crestSpec({ name, seed: slug, accent, kind: 'club' });
    const gali = [club('unsa-gali-fc', 'Unsa Gali FC', '#059669'), club('usna-gali-fc', 'Usna Gali FC', '#059669')];
    expect(gali[0]).not.toEqual(gali[1]);
    // Not enough to differ in one detail: two tiles that share a shape and a fill
    // read as the same crest drawn twice. Require at least two visible differences.
    const differences = (a: typeof gali[0], b: typeof gali[0]) =>
      (['shape', 'primary', 'secondary', 'pattern'] as const).filter((k) => a[k] !== b[k]).length;
    expect(differences(gali[0], gali[1])).toBeGreaterThanOrEqual(2);

    const cup = (orgSlug: string, accent: string) =>
      crestSpec({ name: 'Tiger Cup', seed: `${orgSlug}/tiger-cup`, accent, kind: 'tournament' });
    expect(cup('pilipinas-futbol', '#CE1126')).not.toEqual(cup('davao-unity-sports', '#7C3AED'));
    // (different org accents already make these two look different)
  });

  it('honours a valid primary override and ignores an invalid one', () => {
    const base = { name: 'Tiger Cup', seed: 'x/tiger-cup', accent: '#CE1126', kind: 'tournament' as const };
    expect(crestSpec({ ...base, primary: '#123456' }).primary).toBe('#123456');
    expect(crestSpec({ ...base, primary: 'url(javascript:alert(1))' }).primary).toBe(crestSpec(base).primary);
    expect(crestSpec({ ...base, primary: '#12345' }).primary).toBe(crestSpec(base).primary);
  });

  it('falls back to the default accent for anything that is not a #RRGGBB color', () => {
    expect(safeAccent('#2563EB')).toBe('#2563EB');
    expect(safeAccent('red')).toBe('#059669');
    expect(safeAccent('#12345')).toBe('#059669');
    expect(safeAccent('"><script>')).toBe('#059669');
    expect(safeAccent(null)).toBe('#059669');
  });
});

describe('crestSvg', () => {
  it('cannot be used to inject markup through a club name or a color', () => {
    const spec = crestSpec({ name: '<img src=x onerror=alert(1)> FC', seed: 'evil', accent: '"><script>alert(1)</script>', kind: 'club' });
    const svg = crestSvg(64, spec);
    expect(svg).not.toMatch(/<script|<img|onerror|alert/i);
    // the only tags present are the ones this module draws
    const tags = [...svg.matchAll(/<\/?([a-z]+)/g)].map((m) => m[1]);
    for (const t of new Set(tags)) expect(['svg', 'circle', 'path', 'polygon', 'rect', 'text']).toContain(t);
  });

  it('draws the requested size and the initials', () => {
    const svg = crestSvg(72, { shape: 'hex', primary: '#CE1126', secondary: '#F5C518', text: 'TC', pattern: 'plain' });
    expect(svg).toContain('width="72"');
    expect(svg).toContain('>TC</text>');
  });

  it('draws each pattern with only its own shapes', () => {
    const base = { shape: 'round' as const, primary: '#059669', secondary: '#F5C518', text: 'UG' };
    expect(crestSvg(64, { ...base, pattern: 'plain' })).not.toMatch(/<rect|<polygon/);
    expect(crestSvg(64, { ...base, pattern: 'star' })).toMatch(/<polygon/);
    expect(crestSvg(64, { ...base, pattern: 'underline' })).toMatch(/<rect/);
  });

  it('hashString is stable (a changed hash would silently recolor every crest)', () => {
    expect(hashString('club:cdo-fc')).toBe(hashString('club:cdo-fc'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});
