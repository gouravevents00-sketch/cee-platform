import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CEE AI — Event Management Intelligence',
  description: 'Ask anything about event management — vendor contracts, technical specs, VIP protocols, crisis handling, and more. Powered by Creative Era Events.',
  openGraph: {
    title: 'CEE AI — Event Management Intelligence',
    description: 'Beta access to Creative Era Events AI. Ask anything about event management.',
    siteName: 'CEE AI',
  },
}

export default function CeeAiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
