import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Draw Me Bot — Creative Era Experiences',
  description: 'AI Sketch Generator — See yourself as a hand-drawn sketch!',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function SketchBotLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 overflow-hidden">
      {children}
    </div>
  )
}
