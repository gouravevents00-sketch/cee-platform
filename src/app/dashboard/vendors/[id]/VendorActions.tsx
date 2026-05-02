'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'

export default function VendorRating({ vendorId, currentScore }: { vendorId: string; currentScore: number }) {
  const [score, setScore] = useState(currentScore)
  const [hover, setHover] = useState(0)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function updateScore(s: number) {
    setScore(s)
    setSaving(true)
    await supabase.from('vendors').update({ reliability_score: s }).eq('id', vendorId)
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            onClick={() => updateScore(s)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              size={18}
              className={s <= (hover || score) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}
            />
          </button>
        ))}
      </div>
      {saving && <span className="text-gray-500 text-xs">Saving...</span>}
    </div>
  )
}
