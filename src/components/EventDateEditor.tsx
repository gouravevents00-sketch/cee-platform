'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, AlertTriangle, X } from 'lucide-react'

interface Props {
  eventId: string
  currentDate?: string
  eventName: string
  hasTeam: boolean
  hasVendors: boolean
}

export default function EventDateEditor({ eventId, currentDate, eventName, hasTeam, hasVendors }: Props) {
  const [editing, setEditing] = useState(false)
  const [newDate, setNewDate] = useState(currentDate ? currentDate.split('T')[0] : '')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const impactItems = [
    hasTeam && 'Event team members will be notified',
    hasVendors && 'Vendors may need to be re-confirmed',
    'All stakeholders receive a notification',
  ].filter(Boolean)

  async function handleSave() {
    if (!newDate) return
    setLoading(true)
    const res = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_date: newDate, reason }),
    })
    if (res.ok) {
      setEditing(false)
      setReason('')
      router.refresh()
    }
    setLoading(false)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-gray-600 hover:text-amber-400 transition-colors text-xs flex items-center gap-1 ml-1"
        title="Change event date"
      >
        <CalendarDays size={11} />
        Edit
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Change Event Date</h3>
          <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-4">{eventName}</p>

        <div className="bg-amber-950/40 border border-amber-700/40 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
            <span className="text-amber-400 text-xs font-semibold">Impact Warning</span>
          </div>
          <ul className="space-y-1">
            {impactItems.map((item, i) => (
              <li key={i} className="text-amber-200/70 text-xs flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs text-gray-500 mb-1">New Event Date *</label>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Reason (sent in notification)</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Client request, venue availability"
              className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 w-full placeholder-gray-600"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setEditing(false)}
            className="flex-1 bg-gray-800 text-gray-400 rounded-xl py-2.5 text-sm hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!newDate || loading}
            className="flex-1 bg-amber-500 text-black font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50 hover:bg-amber-400 transition-colors"
          >
            {loading ? 'Saving...' : 'Confirm Change'}
          </button>
        </div>
      </div>
    </div>
  )
}
