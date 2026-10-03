/**
 * Pure, dependency-free email HTML helpers -- split out of email.ts (which
 * imports 'server-only') so this stays unit-testable, same discipline as
 * crest.ts/org-theme.ts/temp-password.ts.
 */

/**
 * Callers compose bodyHtml/title from staff-entered free text (a guardian's
 * name, a club's name) -- escape it before interpolating, same discipline
 * crest.ts already applies to user-input club names in rendered SVG markup.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** One consistent wrapper so the two templates (so far) don't each reinvent spacing/branding. */
export function renderEmailHtml({ title, bodyHtml, ctaText, ctaUrl }: {
  title: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
}): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#f4f5f3;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:28px 28px 0;">
        <p style="margin:0 0 20px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#6b7a6f;font-weight:600;">Dulà HQ</p>
        <h1 style="margin:0 0 16px;font-size:20px;color:#14241a;">${title}</h1>
        <div style="font-size:14px;line-height:1.6;color:#39473d;">${bodyHtml}</div>
        <p style="margin:28px 0;">
          <a href="${ctaUrl}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600;">${ctaText}</a>
        </p>
        <p style="margin:0 0 28px;font-size:12px;color:#8b968e;word-break:break-all;">
          Or paste this link into your browser: ${ctaUrl}
        </p>
      </td></tr>
    </table>
  </body>
</html>`;
}
