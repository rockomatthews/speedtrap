import type { Metadata } from 'next';

import { Providers } from '@/components/Providers';

import './globals.css';

const siteUrl = 'https://speedtrapracing.com';
const logoUrl = `${siteUrl}/brand/logo.svg`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Speed Trap Racing',
  description: 'Speed Trap Racing sim racing center website.',
  applicationName: 'Speed Trap Racing',
  alternates: {
    canonical: '/'
  },
  icons: {
    icon: [{ url: '/brand/logo.svg', type: 'image/svg+xml' }],
    shortcut: ['/brand/logo.svg'],
    apple: [{ url: '/brand/logo.svg', type: 'image/svg+xml' }]
  },
  openGraph: {
    title: 'Speed Trap Racing',
    description: 'Speed Trap Racing sim racing center website.',
    url: siteUrl,
    siteName: 'Speed Trap Racing',
    type: 'website',
    images: [{ url: '/brand/logo.svg' }]
  },
  twitter: {
    card: 'summary',
    title: 'Speed Trap Racing',
    description: 'Speed Trap Racing sim racing center website.',
    images: ['/brand/logo.svg']
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Speed Trap Racing',
    url: siteUrl,
    logo: logoUrl
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}


