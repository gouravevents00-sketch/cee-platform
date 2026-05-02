'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_FLOW: Record<string, string[]> = {
  inquiry: ['quoted', 'cancelled'],
  quoted: ['design_review', 'cancelled'],
  design_review: ['in_production', 'cancelled'],
  in_production: ['ready', 'cancelled'],
  ready: ['installed', 'cancelled'],
  installed: ['completed'],
  completed: [],
  cancelled: [],
}

const STATUS_LABELS: Record<string, string> = {
  quoted: 'Mark as Quoted',
  design_review: 'Send for Design Review',
  in_production: 'Start Production',
  ready: 'Mark as Ready',
  installed: 'Mark as Installed',
  completed: 'Mark as Completed',
  cancelled: 'Cancel Project',
}

interface Props {
  projectId: string
  currentStatus: string
  currentAssigneeId: string | null
  currentQuote: number | null
  currentNotes: string
  team: { id: string; name: string; role: string }[]
  isDirector: boolean
}

export default function ProjectActions({ projectId, currentStatus, currentAssigneeId, currentQuote, currentNotes, team, isDirector }: Props) {
  const router = useRouter()
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId || '')
  const [quote, setQuote] = useState(currentQuote?.toString() || '')
  const [notes, setNotes] = useState(currentNotes)
  const [loading, setLoading] = useState('')

  const nextStatuses = STATUS_FLOW[currentStatus] || []

  async function patch(body: object) {
    const res = await fetch(`/api/production/orders/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) router.refresh()
  }

  async function handleStatus(status: string) {
    setLoading(status)
    await patch({ status })
    setLoading('')
  }

  async function handleAssign() {
    if (!assigneeId) return
    setLoading('assign')
    await patch({ assigned_to: assigneeId })
    setLoading('')
  }

  async function handleSaveQuote() {
    const amount = parseInt(quote)
    if (!amount) return
    setLoading('quote')
    await patch({ quoted_amount: amount, status: currentStatus === 'inquiry' ? 'quoted' : currentStatus })
    setLoading('')
  }

  async function handleSaveNotes() {
    setLoading('notes')
    await patch({ internal_notes: notes })
    setLoading('')
  }

  return (
    <div className="space-y-3 pb-6">
      {/* Quote Amount */}
      {currentStatus !== 'completed' && currentStatus !== 'cancelled' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
            {currentQuote ? 'Update Quote' : 'Add Quote'}
          </h2>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
              <input
                type="number"
                value={quote}
                onChange={e => setQuote(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
              />
            </div>
            <button
              onClick={handleSaveQuote}
              disabled={!quote || loading === 'quote'}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              {loading === 'quote' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Assign Team Member */}
      {isDirector && currentStatus !== 'completed' && currentStatus !== 'cancelled' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Assign Team Member</h2>
          <div className="flex gap-3">
            <select
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="">Select person...</option>
              {team.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
              ))}
            </select>
            <button
              onClick={handleAssign}
              disabled={!assigneeId || loading === 'assign'}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              {loading === 'assign' ? 'Saving...' : 'Assign'}
            </button>
          </div>
        </div>
      )}

      {/* Internal Notes */}
      {isDirector && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Internal Notes</h2>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Cost notes, vendor details, margin info..."
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600 resize-none mb-3"
          />
          <button
            onClick={handleSaveNotes}
            disabled={loading === 'notes'}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            {loading === 'notes' ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
      )}

      {/* Status Actions */}
      {nextStatuses.length > 0 && (
        <div className="flex gap-3">
          {nextStatuses.map(status => (
            <button
              key={status}
              onClick={() => handleStatus(status)}
              disabled={!!loading}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                status === 'cancelled'
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  : 'bg-amber-500 hover:bg-amber-400 text-black'
              }`}
            >
              {loading === status ? 'Updating...' : STATUS_LABELS[status] || status}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
