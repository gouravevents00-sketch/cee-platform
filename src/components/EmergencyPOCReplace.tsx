'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserX, AlertTriangle, X, ChevronDown } from 'lucide-react'

interface Props {
  eventId: string
  eventName: string
  currentPOCName?: string
  currentPOCId?: string
  pocProfiles: { id: string; name: string }[]
}

export default function EmergencyPOCReplace({ eventId, eventName, currentPOCName, currentPOCId, pocProfiles }: Props) {
  const [open, setOpen] = useState(false)
  const [newPOCId, setNewPOCId] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const available = pocProfiles.filter(p => p.id !== currentPOCId)

  async function handleReplace() {
    if (!newPOCId) return
    setLoading(true)
    const res = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poc_id: newPOCId, reason: reason || 'Emergency POC replacement' }),
    })
    if (res.ok) {
      setOpen(false)
      setNewPOCId('')
      setReason('')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 transition-colors"
      >
        <UserX size={13} />
        Replace POC
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Emergency POC Replacement</h3>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-gray-400 text-sm mb-4">{eventName}</p>

            {currentPOCName && (
              <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-3 mb-4 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-red-300 text-xs font-medium">Current POC: {currentPOCName}</p>
                  <p className="text-red-400/60 text-xs">They will lose access to this event</p>
                </div>
              </div>
            )}

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs text-gray-500 mb-1">New POC *</label>
                <div className="relative">
                  <select
                    value={newPOCId}
                    onChange={e => setNewPOCId(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 w-full appearance-none"
                  >
                    <option value="">Select replacement POC...</option>
                    {available.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Unavailable, emergency, conflict"
                  className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 w-full placeholder-gray-600"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 bg-gray-800 text-gray-400 rounded-xl py-2.5 text-sm hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReplace}
                disabled={!newPOCId || loading}
                className="flex-1 bg-red-600 text-white font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50 hover:bg-red-500 transition-colors"
              >
                {loading ? 'Replacing...' : 'Replace POC'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
