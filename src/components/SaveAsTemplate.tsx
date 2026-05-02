'use client'

import { useState } from 'react'
import { BookmarkPlus, Check } from 'lucide-react'

export default function SaveAsTemplate({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(eventName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    await fetch(`/api/events/${eventId}/save-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setSaved(true)
    setSaving(false)
    setTimeout(() => { setSaved(false); setOpen(false) }, 2000)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white px-3 py-2 rounded-xl transition-colors"
      >
        <BookmarkPlus size={13} /> Save as Template
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Template name..."
        className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 w-48"
        autoFocus
      />
      {saved ? (
        <span className="flex items-center gap-1 text-green-400 text-sm"><Check size={14} /> Saved!</span>
      ) : (
        <>
          <button onClick={save} disabled={saving || !name.trim()}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm px-3 py-2 rounded-xl disabled:opacity-50 transition-colors">
            {saving ? '...' : 'Save'}
          </button>
          <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-sm px-2 py-2">
            ✕
          </button>
        </>
      )}
    </div>
  )
}
