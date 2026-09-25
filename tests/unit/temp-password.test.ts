import { describe, it, expect } from 'vitest';
import { randomInt } from 'node:crypto';
import {
  generateTempPassword, formatForReading, checkNewPassword, looksLikeEmail,
  TEMP_PASSWORD_LENGTH, MIN_NEW_PASSWORD_LENGTH,
} from '../../src/lib/temp-password';

describe('generateTempPassword', () => {
  it('has the right length and only unambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      const p = generateTempPassword(randomInt);
      expect(p).toHaveLength(TEMP_PASSWORD_LENGTH);
      expect(p).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/); // no 0 O 1 l I
    }
  });

  it('always contains an uppercase letter, a lowercase letter and a digit', () => {
    for (let i = 0; i < 500; i++) {
      const p = generateTempPassword(randomInt);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[0-9]/);
    }
  });

  it('is not derived from anything: 500 draws are all different', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateTempPassword(randomInt)));
    expect(seen.size).toBe(500);
  });

  it('uses the injected randomness, so it is testable', () => {
    const zero = generateTempPassword(() => 0);
    expect(generateTempPassword(() => 0)).toBe(zero);
  });
});

describe('formatForReading', () => {
  it('groups in fours for reading aloud', () => {
    expect(formatForReading('Kq7m2XpB9fTd')).toBe('Kq7m-2XpB-9fTd');
  });
});

describe('checkNewPassword', () => {
  const email = 'maria.santos@example.com';
  it('rejects short passwords', () => {
    expect(checkNewPassword('Ab1', email)).toMatch(/at least/);
    expect(checkNewPassword('x'.repeat(MIN_NEW_PASSWORD_LENGTH - 1), email)).toMatch(/at least/);
  });
  it('rejects one that contains the email name, however it is capitalised', () => {
    expect(checkNewPassword('Maria.Santos-2026!', email)).toMatch(/email name/);
  });
  it('rejects the temporary password itself', () => {
    expect(checkNewPassword('Kq7m2XpB9fTd', email, 'Kq7m2XpB9fTd')).toMatch(/new password/);
  });
  it('rejects all-lowercase', () => {
    expect(checkNewPassword('correcthorsebattery', email)).toMatch(/Mix/);
  });
  it('accepts a reasonable password', () => {
    expect(checkNewPassword('Correct-Horse-7-Battery', email)).toBeNull();
  });
});

describe('looksLikeEmail', () => {
  it('accepts and rejects the obvious cases', () => {
    expect(looksLikeEmail('a@b.co')).toBe(true);
    expect(looksLikeEmail('not an email')).toBe(false);
    expect(looksLikeEmail('a@b')).toBe(false);
  });
});
