'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export default function DeleteClientButton({ clientId }: { clientId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/clients/${clientId}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error)
      setLoading(false)
      setConfirming(false)
      return
    }
    router.push('/dashboard/clients')
    router.refresh()
  }

  if (error) {
    return (
      <div className="bg-red-950/30 border border-red-700/40 rounded-xl px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    )
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-sm">Are you sure?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Deleting...' : 'Yes, delete'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 text-sm hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-500 text-sm hover:text-red-400 hover:border-red-800 transition-colors"
    >
      <Trash2 size={13} /> Delete Client
    </button>
  )
}
