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
};

module.exports = nextConfig;
