import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'AI Photo Booth — Creative Era Experiences',
  description: 'AI-powered photo booth for events',
  manifest: '/manifest.json',
  icons: {
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CEE Photo Booth',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#f59e0b',
}

export default function BoothLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 overflow-hidden">
      {children}
    </div>
  )
}
