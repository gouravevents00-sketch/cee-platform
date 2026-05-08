import { Suspense } from 'react'
import PhotoBooth from './PhotoBooth'

export default function BoothPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-black text-white">Loading…</div>}>
      <PhotoBooth />
    </Suspense>
  )
}
