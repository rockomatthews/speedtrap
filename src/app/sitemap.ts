import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://speedtrapracing.com';
  const routes = ['/', '/login', '/merch', '/how-it-works', '/pricing', '/race-radar'];
  const now = new Date();

  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: now,
    changeFrequency: route === '/' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : 0.7
  }));
}

