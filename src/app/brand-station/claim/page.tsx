import { Suspense } from 'react'
import ClaimActivation from './ClaimActivation'

export default function ClaimActivationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ClaimActivation />
    </Suspense>
  )
}
