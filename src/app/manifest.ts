import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Speed Trap Racing',
    short_name: 'Speed Trap',
    description: 'Speed Trap Racing sim racing center website.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/brand/logo.svg',
        type: 'image/svg+xml',
        sizes: 'any'
      }
    ]
  };
}

