import { describe, it, expect } from 'vitest';
import { bundleFor, renderBlock, applyBlocks, REUSED_TOURNAMENT_KEYS } from '../../scripts/lib/guide-permissions.mjs';

const perm = (key: string, scope: string, label: string, description = `${label} description`) => ({ key, scope, label, description });

const catalog = {
  permissions: [
    perm('view_finances', 'club', 'View finances', 'View club-wide fee ledger'),
    perm('manage_club', 'club', 'Manage club'),
    perm('view_team', 'team', 'View team'),
    perm('manage_attendance', 'team', 'Manage attendance'),
    perm('manage_tournament', 'tournament', 'Manage tournament'),
    perm('manage_tournament_finances', 'tournament', 'Manage tournament finances', 'Fees | payments'),
    // reused: catalogued as club scope, but valid for a tournament role too
    perm('view_audit_log', 'club', 'View audit log'),
    perm('view_schedule', 'player', 'View schedule'),
    perm('manage_fees', 'player', 'Manage fees'),
  ],
  roleDefaults: [
    { role: 'treasurer', permission_key: 'view_finances' },
    { role: 'treasurer', permission_key: 'manage_tournament_finances' },
    { role: 'treasurer', permission_key: 'view_audit_log' },
    { role: 'coach', permission_key: 'view_team' },
    { role: 'coach', permission_key: 'manage_attendance' },
    { role: 'organizer', permission_key: 'manage_tournament' },
    { role: 'organizer', permission_key: 'view_audit_log' },
  ],
  guardianDefaults: [{ permission_key: 'view_schedule' }, { permission_key: 'manage_fees' }],
};

describe('bundleFor', () => {
  it('a club context keeps club and team keys and drops tournament ones', () => {
    const keys = bundleFor(catalog, 'club', 'treasurer').map((p: any) => p.key);
    expect(keys).toEqual(expect.arrayContaining(['view_finances', 'view_audit_log']));
    expect(keys).not.toContain('manage_tournament_finances');
  });

  it('a tournament context keeps tournament keys plus the shared ones, and drops club-only keys', () => {
    const keys = bundleFor(catalog, 'tournament', 'treasurer').map((p: any) => p.key);
    expect(keys).toEqual(expect.arrayContaining(['manage_tournament_finances', 'view_audit_log']));
    expect(keys).not.toContain('view_finances');
  });

  it('the shared keys are exactly the three the tournament resolver allows', () => {
    expect([...REUSED_TOURNAMENT_KEYS].sort()).toEqual(['manage_account_status', 'submit_support_request', 'view_audit_log']);
  });

  it('a guardian context lists the guardian defaults', () => {
    expect(bundleFor(catalog, 'guardian', null).map((p: any) => p.key).sort()).toEqual(['manage_fees', 'view_schedule']);
  });

  it('refuses a role the catalog has never heard of, rather than rendering an empty table', () => {
    expect(() => bundleFor(catalog, 'club', 'wizard')).toThrow(/wizard/);
  });

  it('refuses an unknown context', () => {
    expect(() => bundleFor(catalog, 'galaxy', 'coach')).toThrow(/galaxy/);
  });
});

describe('renderBlock', () => {
  it('orders by reach then label, and says how far each permission reaches', () => {
    const md = renderBlock(catalog, 'club', 'coach');
    expect(md.indexOf('Manage attendance')).toBeLessThan(md.indexOf('View team'));
    expect(md).toContain('Assigned teams only');
  });

  it('a club manager reaches every team, not just assigned ones', () => {
    // has_staff_permission short-circuits the team fence for club_manager, so
    // telling one that their team-level permissions apply to "assigned teams
    // only" would be wrong. Any other role keeps the narrow wording.
    const withManager = {
      ...catalog,
      roleDefaults: [...catalog.roleDefaults, { role: 'club_manager', permission_key: 'view_team' }],
    };
    expect(renderBlock(withManager, 'club', 'club_manager')).toContain('Every team in the club');
    expect(renderBlock(withManager, 'club', 'club_manager')).not.toContain('Assigned teams only');
    expect(renderBlock(withManager, 'club', 'coach')).toContain('Assigned teams only');
  });

  it('escapes pipes so a description cannot break the table', () => {
    const md = renderBlock(catalog, 'tournament', 'treasurer');
    expect(md).toContain('Fees \\| payments');
  });

  it('is stable: rendering twice gives identical text', () => {
    expect(renderBlock(catalog, 'club', 'treasurer')).toBe(renderBlock(catalog, 'club', 'treasurer'));
  });
});

describe('applyBlocks', () => {
  const guide = [
    '# A guide',
    'Some prose that must not change.',
    '<!-- BEGIN permissions: club:coach -->',
    'stale content',
    '<!-- END permissions -->',
    'More prose.',
    '',
  ].join('\n');

  it('replaces only what is between the markers', () => {
    const { text, changed } = applyBlocks(guide, catalog);
    expect(changed).toBe(true);
    expect(text).toContain('Some prose that must not change.');
    expect(text).toContain('More prose.');
    expect(text).not.toContain('stale content');
    expect(text).toContain('Manage attendance');
  });

  it('is idempotent: a second pass changes nothing', () => {
    const once = applyBlocks(guide, catalog).text;
    const twice = applyBlocks(once, catalog);
    expect(twice.changed).toBe(false);
    expect(twice.text).toBe(once);
  });

  it('leaves a document with no markers untouched', () => {
    const plain = '# Nothing here\n';
    expect(applyBlocks(plain, catalog)).toEqual({ text: plain, changed: false, blocks: 0 });
  });

  it('fails loudly on a BEGIN with no END', () => {
    expect(() => applyBlocks('<!-- BEGIN permissions: club:coach -->\nno end', catalog)).toThrow(/END/);
  });

  it('fails loudly on a marker naming a role that does not exist', () => {
    expect(() => applyBlocks('<!-- BEGIN permissions: club:nobody -->\n<!-- END permissions -->', catalog)).toThrow(/nobody/);
  });

  it('copes with Windows line endings', () => {
    const crlf = guide.replace(/\n/g, '\r\n');
    const { text } = applyBlocks(crlf, catalog);
    expect(text).toContain('Manage attendance');
    expect(text).toContain('\r\n');
    expect(text).not.toMatch(/[^\r]\n/);
  });
});
