import { Suspense } from 'react'
import MosaicDisplay from './MosaicDisplay'

export default function MosaicDisplayPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center">
        <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MosaicDisplay />
    </Suspense>
  )
}
