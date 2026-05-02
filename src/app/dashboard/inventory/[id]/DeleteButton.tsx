'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export default function DeleteButton({ itemId, itemName }: { itemId: string; itemName: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await fetch(`/api/inventory/${itemId}`, { method: 'DELETE' })
    router.push('/dashboard/inventory')
    router.refresh()
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-red-400 text-xs">Delete &quot;{itemName}&quot;?</span>
        <button onClick={handleDelete} disabled={loading}
          className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-semibold px-3 py-2 rounded-xl text-xs transition-colors">
          {loading ? '...' : 'Yes, Delete'}
        </button>
        <button onClick={() => setConfirm(false)}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-3 py-2 rounded-xl text-xs transition-colors">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirm(true)}
      className="flex items-center gap-2 bg-gray-800 hover:bg-red-500/20 hover:text-red-400 text-gray-500 font-medium px-4 py-2.5 rounded-xl text-sm transition-colors">
      <Trash2 size={14} />
    </button>
  )
}
