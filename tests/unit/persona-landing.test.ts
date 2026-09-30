import { describe, it, expect } from 'vitest';
import { personaLanding, personaLinks } from '../../src/lib/persona-landing';

describe('personaLanding: where "/" sends someone who is signed in', () => {
  it('a guardian with no organization goes to /guardian', () => {
    expect(personaLanding({ hasOrg: false, guardian: true, player: false })).toBe('/guardian');
  });

  it('a player with no organization goes to /player', () => {
    expect(personaLanding({ hasOrg: false, guardian: false, player: true })).toBe('/player');
  });

  it('someone who is both goes to /guardian (they can reach /player from the nav)', () => {
    expect(personaLanding({ hasOrg: false, guardian: true, player: true })).toBe('/guardian');
  });

  it('anyone who belongs to an organization keeps the organization home, guardian or not', () => {
    // A coach whose own child plays for the club is a guardian too. Bouncing them
    // to /guardian would lock them out of the club tiles.
    expect(personaLanding({ hasOrg: true, guardian: true, player: false })).toBeNull();
    expect(personaLanding({ hasOrg: true, guardian: false, player: true })).toBeNull();
  });

  it('a tournament organizer with no organization is not bounced past the link to their console', () => {
    // Tournament staff have no org membership, so hasOrg is false for them. If they are
    // also a guardian, redirecting would hide the "Tournaments you manage" strip that
    // is now their only way to the console from the homepage.
    expect(personaLanding({ hasOrg: false, managesTournaments: true, guardian: true, player: false })).toBeNull();
    expect(personaLanding({ hasOrg: false, managesTournaments: false, guardian: true, player: false })).toBe('/guardian');
  });

  it('someone who is neither a guardian nor a player keeps the public homepage', () => {
    expect(personaLanding({ hasOrg: false, guardian: false, player: false })).toBeNull();
  });

  it('a linked official with no organization goes to /official, after guardian and player', () => {
    expect(personaLanding({ hasOrg: false, guardian: false, player: false, official: true })).toBe('/official');
    expect(personaLanding({ hasOrg: false, guardian: true, player: false, official: true })).toBe('/guardian');
  });

  it('an official who belongs to an organization keeps the organization home', () => {
    expect(personaLanding({ hasOrg: true, guardian: false, player: false, official: true })).toBeNull();
  });
});

describe('personaLinks: the nav links for people who have a guardian, player or official page', () => {
  it('offers one link per page the person actually has', () => {
    expect(personaLinks({ guardian: true, player: false })).toEqual([{ href: '/guardian', label: 'My children' }]);
    expect(personaLinks({ guardian: false, player: true })).toEqual([{ href: '/player', label: 'My profile' }]);
    expect(personaLinks({ guardian: true, player: true }).map((l) => l.href)).toEqual(['/guardian', '/player']);
    expect(personaLinks({ guardian: false, player: false, official: true })).toEqual([{ href: '/official', label: 'My officiating' }]);
  });

  it('offers nothing to everyone else', () => {
    expect(personaLinks({ guardian: false, player: false })).toEqual([]);
  });
});
