import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Messier - Property Housekeeping',
    template: '%s | Messier'
  },
  description: 'Professional housekeeping management for vacation rentals, Airbnb properties, and short-term stays. Track cleanings, manage teams, and streamline operations.',
  keywords: ['housekeeping', 'property management', 'vacation rental', 'airbnb', 'cleaning', 'short-term rental', 'hospitality'],
  authors: [{ name: 'Messier' }],
  creator: 'Messier',
  publisher: 'Messier',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Messier'
  },
  formatDetection: {
    telephone: false
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://messier.app',
    siteName: 'Messier',
    title: 'Messier - Property Housekeeping',
    description: 'Professional housekeeping management for vacation rentals and short-term stays',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Messier - Property Housekeeping'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Messier - Property Housekeeping',
    description: 'Professional housekeeping management for vacation rentals and short-term stays',
    images: ['/og-image.png']
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ]
  }
};

export const viewport: Viewport = {
  themeColor: '#0ea5e9',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon-32.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}