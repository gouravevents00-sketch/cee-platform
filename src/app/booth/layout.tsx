import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'AI Photo Booth — Creative Era Experiences',
  description: 'AI-powered photo booth for events',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function BoothLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 overflow-hidden">
      {children}
    </div>
  )
}
