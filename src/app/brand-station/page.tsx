import { Suspense } from 'react'
import BrandStation from './BrandStation'

export default function BrandStationPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BrandStation />
    </Suspense>
  )
}
