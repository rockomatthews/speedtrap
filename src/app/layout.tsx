import type { Metadata } from 'next';

import { Providers } from '@/components/Providers';

import './globals.css';

const siteUrl = 'https://speedtrapracing.com';
/** Raster logo for structured data — Google prefers PNG ≥112×112 over SVG for Organization logos. */
const logoUrl = `${siteUrl}/brand/logo-512.png`;
const brandDescription = 'Advanced Sim Racing Center and Bar';
const defaultTitle = `Speed Trap Racing — ${brandDescription}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: '%s | Speed Trap Racing'
  },
  description: brandDescription,
  applicationName: 'Speed Trap Racing',
  alternates: {
    canonical: '/'
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon', type: 'image/png', sizes: '512x512' },
      { url: '/brand/logo-512.png', type: 'image/png', sizes: '512x512' }
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/apple-icon', type: 'image/png', sizes: '180x180' }]
  },
  openGraph: {
    title: 'Speed Trap Racing',
    description: brandDescription,
    url: siteUrl,
    siteName: 'Speed Trap Racing',
    type: 'website',
    images: [
      {
        url: '/brand/og-share.png',
        width: 1200,
        height: 630,
        alt: 'Speed Trap Racing'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Speed Trap Racing',
    description: brandDescription,
    images: ['/brand/og-share.png']
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Speed Trap Racing',
    description: brandDescription,
    url: siteUrl,
    logo: logoUrl
  };
  const webSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Speed Trap Racing',
    description: brandDescription,
    url: siteUrl
  };

  return (
    <html lang="en">
      <head>
        <meta name="google-site-verification" content="GkNUGFLmikgRzESUfPPJewlH4f44dMz3K1YRZizwReM" />
        {/* Static /favicon.ico is what Googlebot fetches most reliably for SERP icons. */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon" type="image/png" sizes="512x512" />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationSchema, webSiteSchema]) }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}


