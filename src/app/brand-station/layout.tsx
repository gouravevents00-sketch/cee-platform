import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Brand Activation Station',
  description: 'Interactive brand experience',
  manifest: '/manifest-station.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Brand Station' },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function BrandStationLayout({ children }: { children: React.ReactNode }) {
  return children
}
