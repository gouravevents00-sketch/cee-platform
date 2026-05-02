'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  itemId: string
  qtyTotal: number
  qtyAvailable: number
  unit: string
}

export default function QtyUpdater({ itemId, qtyTotal, qtyAvailable, unit }: Props) {
  const router = useRouter()
  const [total, setTotal] = useState(qtyTotal.toString())
  const [available, setAvailable] = useState(qtyAvailable.toString())
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setLoading(true)
    const res = await fetch(`/api/inventory/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qty_total: parseInt(total) || 0,
        qty_available: parseInt(available) || 0,
      }),
    })
    setLoading(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
      <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Update Quantity</h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-gray-400 text-xs font-medium block mb-1.5">Total ({unit})</label>
          <input type="number" min={0} value={total} onChange={e => setTotal(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-gray-400 text-xs font-medium block mb-1.5">Available ({unit})</label>
          <input type="number" min={0} value={available} onChange={e => setAvailable(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500" />
        </div>
      </div>
      <button onClick={handleSave} disabled={loading}
        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold py-3 rounded-xl text-sm transition-colors">
        {loading ? 'Saving...' : saved ? 'Saved ✓' : 'Update Qty'}
      </button>
    </div>
  )
}
