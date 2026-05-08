'use client'

import { useEffect, useState } from 'react'

const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  call:     { icon: '📞', label: 'Call',     color: 'bg-blue-900/30 text-blue-300 border-blue-800/40' },
  email:    { icon: '📧', label: 'Email',    color: 'bg-purple-900/30 text-purple-300 border-purple-800/40' },
  whatsapp: { icon: '💬', label: 'WhatsApp', color: 'bg-green-900/30 text-green-300 border-green-800/40' },
  meeting:  { icon: '🤝', label: 'Meeting',  color: 'bg-amber-900/30 text-amber-300 border-amber-800/40' },
  proposal: { icon: '📄', label: 'Proposal', color: 'bg-indigo-900/30 text-indigo-300 border-indigo-800/40' },
  note:     { icon: '📝', label: 'Note',     color: 'bg-gray-800 text-gray-400 border-gray-700' },
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

interface Interaction {
  id: string
  type: string
  note: string
  created_at: string
  logger: { name: string } | null
}

export default function LeadInteractions({ leadId }: { leadId: string }) {
  const [items, setItems] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState('call')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/leads/${leadId}/interactions`)
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [leadId])

  async function logInteraction() {
    if (!note.trim()) return
    setSaving(true)
    const res = await fetch(`/api/leads/${leadId}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, note }),
    })
    const data = await res.json()
    if (res.ok) {
      setItems(prev => [data, ...prev])
      setNote('')
      setShowForm(false)
    }
    setSaving(false)
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-800/60">
      <div className="flex items-center justify-between mb-2">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Interaction Log</p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            + Log
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-gray-800/60 border border-gray-700/60 rounded-lg p-3 mb-3 space-y-2">
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(TYPE_META).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => setType(key)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  type === key ? meta.color : 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-600'
                }`}
              >
                {meta.icon} {meta.label}
              </button>
            ))}
          </div>
          <textarea
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
            placeholder="What happened? Be specific — date, outcome, next step…"
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={logInteraction}
              disabled={saving || !note.trim()}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-xs font-semibold py-1.5 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setShowForm(false); setNote('') }}
              className="px-3 text-xs text-gray-500 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <p className="text-gray-600 text-xs">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-600 text-xs">No interactions yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const meta = TYPE_META[item.type] ?? TYPE_META.note
            return (
              <div key={item.id} className="flex gap-2.5">
                <div className="mt-0.5 flex-shrink-0">
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${meta.color}`}>
                    {meta.icon}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-gray-300 text-xs leading-relaxed">{item.note}</p>
                  <p className="text-gray-600 text-xs mt-0.5">
                    {item.logger?.name ?? 'Unknown'} · {relativeTime(item.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
