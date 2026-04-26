import type { Metadata } from 'next';

import { Providers } from '@/components/Providers';

import './globals.css';

const siteUrl = 'https://speedtrapracing.com';
const logoUrl = `${siteUrl}/brand/logo.svg`;
const brandDescription = 'Advanced Sim Racing Center and Bar';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Speed Trap Racing',
  description: brandDescription,
  applicationName: 'Speed Trap Racing',
  alternates: {
    canonical: '/'
  },
  icons: {
    icon: [{ url: '/icon', type: 'image/png' }],
    shortcut: ['/icon'],
    apple: [{ url: '/apple-icon', type: 'image/png' }]
  },
  openGraph: {
    title: 'Speed Trap Racing',
    description: brandDescription,
    url: siteUrl,
    siteName: 'Speed Trap Racing',
    type: 'website',
    images: [{ url: '/brand/logo.svg' }]
  },
  twitter: {
    card: 'summary',
    title: 'Speed Trap Racing',
    description: brandDescription,
    images: ['/brand/logo.svg']
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


