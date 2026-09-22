/**
 * Where a signed-in person's "home" is, when it isn't the organization home.
 *
 * Login always lands on "/". For an organization member that shows their product
 * tiles, but a guardian or player has no organization, so "/" showed them the
 * public directory with no link anywhere to the page written for them
 * (/guardian, /player). The only ways in were the /demo buttons and notification
 * links.
 *
 * Pure, so the rule is testable without a browser.
 */

export type Personas = { guardian: boolean; player: boolean };

/**
 * A redirect target for "/", or null to leave the person where they are.
 *
 * Only someone with NO organization and no tournament to manage is redirected. A
 * coach whose own child plays for the club is a guardian too, and sending them to
 * /guardian would lock them out of the club tiles; they get a nav link instead (see
 * personaLinks).
 */
export function personaLanding(
  input: Personas & { hasOrg: boolean; managesTournaments?: boolean }
): '/guardian' | '/player' | null {
  // Tournament staff belong to no organization, so hasOrg is false for them; without
  // this they would be bounced past the strip that links to their console.
  if (input.hasOrg || input.managesTournaments) return null;
  if (input.guardian) return '/guardian';
  if (input.player) return '/player';
  return null;
}

/** Nav links for whichever of the two pages this person has. */
export function personaLinks(input: Personas): { href: string; label: string }[] {
  const links: { href: string; label: string }[] = [];
  if (input.guardian) links.push({ href: '/guardian', label: 'My children' });
  if (input.player) links.push({ href: '/player', label: 'My profile' });
  return links;
}
