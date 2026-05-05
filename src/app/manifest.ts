import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DW Reports',
    short_name: 'DW Reports',
    description: 'Report management system for Degler Whiting',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#004070',
    icons: [
      {
        src: '/web-app-manifest-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/web-app-manifest-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
