import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dulà HQ',
    short_name: 'Dulà HQ',
    description: 'Club setup, staff management, and tournaments -- one place for clubs and the tournaments they run.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#059669',
    icons: [
      { src: '/icon-192', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png' },
    ],
  };
}
