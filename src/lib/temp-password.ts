/**
 * Temporary passwords for logins an IT admin creates (docs/proposals/email-and-
 * invitations.md is parked; this replaces "invite by email" for setup).
 *
 * Deliberately NOT derived from anything about the person: an earlier idea was
 * "Dulhq_<email username>", which anyone who knows the address could work out. This
 * is random, shown to the admin once, and only ever stored as Supabase's hash.
 *
 * Pure and dependency-free so it can be unit-tested; randomness is injected so the
 * server passes crypto.randomInt and the tests pass something deterministic.
 */

// No 0/O, 1/l/I: the admin reads it out or copies it into a message.
const LETTERS_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LETTERS_LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ALL = LETTERS_UPPER + LETTERS_LOWER + DIGITS;

export const TEMP_PASSWORD_LENGTH = 12;
/** How long a temporary password works if the person never signs in and changes it. */
export const TEMP_PASSWORD_HOURS = 72;
export const MIN_NEW_PASSWORD_LENGTH = 10;

export type RandomInt = (maxExclusive: number) => number;

export function generateTempPassword(randomInt: RandomInt, length = TEMP_PASSWORD_LENGTH): string {
  // One of each class guaranteed, the rest from the whole alphabet, then shuffled so
  // the guaranteed characters aren't always in the first three positions.
  const chars = [
    LETTERS_UPPER[randomInt(LETTERS_UPPER.length)],
    LETTERS_LOWER[randomInt(LETTERS_LOWER.length)],
    DIGITS[randomInt(DIGITS.length)],
  ];
  while (chars.length < length) chars.push(ALL[randomInt(ALL.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Groups of four for reading aloud: "Kq7m-2XpB-9fTd". Display only; the dashes aren't part of it. */
export function formatForReading(password: string): string {
  return password.match(/.{1,4}/g)?.join('-') ?? password;
}

export type PasswordProblem = string | null;

/** The rules for the password a person chooses when they first sign in. */
export function checkNewPassword(password: string, email: string, tempPassword?: string): PasswordProblem {
  if (password.length < MIN_NEW_PASSWORD_LENGTH) return `Use at least ${MIN_NEW_PASSWORD_LENGTH} characters.`;
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  if (local.length >= 3 && password.toLowerCase().includes(local)) return 'Don’t include your email name in your password.';
  if (tempPassword && password === tempPassword) return 'Choose a new password, not the temporary one.';
  if (!/[a-z]/.test(password) || !/[A-Z0-9]/.test(password)) return 'Mix lowercase letters with capitals or numbers.';
  return null;
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}
