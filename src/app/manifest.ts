import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Speed Trap Racing',
    short_name: 'Speed Trap',
    description: 'Advanced Sim Racing Center and Bar.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/brand/logo-512.png',
        type: 'image/png',
        sizes: '512x512',
        purpose: 'any'
      }
    ]
  };
}

