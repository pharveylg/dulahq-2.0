import { describe, it, expect } from 'vitest';
import { escapeHtml, renderEmailHtml } from '../../src/lib/email-template';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<b>&"'</b>`)).toBe('&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
  });

  it('neutralizes a markup-injection attempt in a staff-entered name', () => {
    const out = escapeHtml('<img src=x onerror=alert(1)>" onmouseover="steal()');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('"');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Rosario Ignacio')).toBe('Rosario Ignacio');
  });
});

describe('renderEmailHtml', () => {
  it('includes the title, body, and link exactly once each', () => {
    const html = renderEmailHtml({
      title: 'Reset your password',
      bodyHtml: 'Click the button below.',
      ctaText: 'Choose a new password',
      ctaUrl: 'https://dulahq.app/auth/confirm?token_hash=abc&type=recovery&next=/reset-password',
    });
    expect(html).toContain('Reset your password');
    expect(html).toContain('Click the button below.');
    expect(html).toContain('Choose a new password');
    // The CTA URL appears twice by design: once as the button's href, once as
    // plain text for a client that strips links.
    expect(html.split('https://dulahq.app/auth/confirm?token_hash=abc&type=recovery&next=/reset-password').length - 1).toBe(2);
  });

  it('is a complete, well-formed document', () => {
    const html = renderEmailHtml({ title: 'T', bodyHtml: 'B', ctaText: 'C', ctaUrl: 'https://dulahq.app/' });
    expect(html.trim().startsWith('<!doctype html>')).toBe(true);
    expect(html.trim().endsWith('</html>')).toBe(true);
  });
});
