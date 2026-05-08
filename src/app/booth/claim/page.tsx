import { Suspense } from 'react'
import ClaimPhoto from './ClaimPhoto'

export default function ClaimPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-gray-950 text-white text-sm">
        Loading your photo...
      </div>
    }>
      <ClaimPhoto />
    </Suspense>
  )
}
