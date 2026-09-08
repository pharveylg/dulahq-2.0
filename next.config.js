/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Default server action body limit is 1MB, too small for photo
    // uploads (media-actions.ts). 10MB matches a reasonable single-photo
    // ceiling without opening the door to large video uploads via the
    // same path.
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Single-origin proxy for the Tournament Manager app (pharveylg/DulaHQ,
  // Vercel project `dula-hq`), per CLAUDE.md §6.A. It's a single-file Vite
  // SPA that routes on location.pathname and loads every asset from
  // absolute CDN URLs, so proxying the HTML document at these paths is
  // sufficient -- no separate asset rewrite is needed. Proxies to the
  // project's stable `dula-hq.vercel.app` alias, not the new domain, so
  // this keeps working regardless of what custom domain that project has.
  //
  // /platformconsole is deliberately NOT proxied (was, until the platform
  // console consolidation): that path now serves this app's own console,
  // which is the canonical one going forward. The Tournament Manager's own
  // Superadmin Console still exists but is reachable only at the
  // break-glass dula-hq.vercel.app/platformconsole URL directly.
  async rewrites() {
    return [
      { source: '/t/:slug', destination: 'https://dula-hq.vercel.app/t/:slug' },
      { source: '/t/:slug/:path*', destination: 'https://dula-hq.vercel.app/t/:slug/:path*' },
    ];
  },
};

module.exports = nextConfig;
