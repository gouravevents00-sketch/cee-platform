'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

interface BoothFilter {
  id: string
  name: string
  emoji: string
  description: string
  prompt: string
  active: boolean
  sort_order: number
}

const EMPTY: Omit<BoothFilter, 'id' | 'sort_order'> = {
  name: '', emoji: '✨', description: '', prompt: '', active: true,
}

export default function FilterManager({ initialFilters }: { initialFilters: BoothFilter[] }) {
  const [filters, setFilters] = useState<BoothFilter[]>(initialFilters)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null)

  function openNew() {
    setForm(EMPTY)
    setEditingId('new')
  }

  function openEdit(f: BoothFilter) {
    setForm({ name: f.name, emoji: f.emoji, description: f.description, prompt: f.prompt, active: f.active })
    setEditingId(f.id)
  }

  function cancel() { setEditingId(null); setForm(EMPTY) }

  async function save() {
    if (!form.name.trim() || !form.prompt.trim()) return
    setSaving(true)
    try {
      if (editingId === 'new') {
        const res = await fetch('/api/booth/filters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, sort_order: filters.length }),
        })
        const { filter } = await res.json()
        setFilters(prev => [...prev, filter])
      } else {
        const res = await fetch(`/api/booth/filters/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form }),
        })
        const { filter } = await res.json()
        setFilters(prev => prev.map(f => f.id === editingId ? filter : f))
      }
      cancel()
    } finally { setSaving(false) }
  }

  async function toggleActive(f: BoothFilter) {
    const res = await fetch(`/api/booth/filters/${f.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, active: !f.active }),
    })
    const { filter } = await res.json()
    setFilters(prev => prev.map(x => x.id === f.id ? filter : x))
  }

  async function deleteFilter(id: string) {
    if (!confirm('Delete this style? This cannot be undone.')) return
    await fetch(`/api/booth/filters/${id}`, { method: 'DELETE' })
    setFilters(prev => prev.filter(f => f.id !== id))
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/experiences/booth" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-white text-xl font-bold">AI Style Manager</h1>
          <p className="text-gray-500 text-sm">Add, edit or remove photo booth transformations</p>
        </div>
        <button onClick={openNew}
          className="ml-auto flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">
          <Plus size={15} /> Add Style
        </button>
      </div>

      {/* Add/Edit Form */}
      {editingId && (
        <div className="bg-gray-900 border border-amber-500/30 rounded-2xl p-5 space-y-4">
          <h2 className="text-white font-semibold text-sm">{editingId === 'new' ? 'New Style' : 'Edit Style'}</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Style Name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Royal Mughal"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Emoji</label>
              <input value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))}
                placeholder="👑"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1.5">Short Description</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="e.g. Indian Maharaja palace portrait"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-gray-400 text-xs font-medium">AI Prompt</label>
              <span className="text-gray-600 text-xs">{form.prompt.length} chars</span>
            </div>
            <textarea value={form.prompt} onChange={e => setForm(p => ({ ...p, prompt: e.target.value }))}
              placeholder="Describe the full scene in detail — outfit, background, lighting, mood, camera style, quality (8K, cinematic, etc.)"
              rows={5}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600 resize-none" />
            <p className="text-gray-600 text-xs mt-1.5">
              Tip: Describe outfit + background + lighting + quality. E.g. "hyperrealistic Bollywood movie poster, person wearing silk kurta with gold embroidery, grand palace entrance with fireworks, dramatic backlighting, 8K cinematic"
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={cancel} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-5 py-2.5 rounded-xl text-sm transition-colors">
              Cancel
            </button>
            <button onClick={save} disabled={saving || !form.name.trim() || !form.prompt.trim()}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold px-6 py-2.5 rounded-xl text-sm transition-all">
              {saving ? 'Saving...' : editingId === 'new' ? 'Add Style' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Filter List */}
      {filters.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-600 text-sm">No styles yet.</p>
          <button onClick={openNew} className="mt-3 text-amber-500 text-sm hover:text-amber-400 transition-colors">
            + Add your first style
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filters.map(f => (
            <div key={f.id}
              className={`bg-gray-900 border rounded-2xl p-4 transition-all ${f.active ? 'border-gray-800' : 'border-gray-800/40 opacity-50'}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">{f.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm">{f.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${f.active ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                      {f.active ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                  {f.description && <p className="text-gray-500 text-xs mt-0.5">{f.description}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setExpandedPrompt(expandedPrompt === f.id ? null : f.id)}
                    className="p-2 text-gray-600 hover:text-gray-300 transition-colors" title="View prompt">
                    {expandedPrompt === f.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  <button onClick={() => toggleActive(f)}
                    className="p-2 text-gray-600 hover:text-amber-400 transition-colors" title="Toggle active">
                    {f.active ? <ToggleRight size={18} className="text-green-400" /> : <ToggleLeft size={18} />}
                  </button>
                  <button onClick={() => openEdit(f)}
                    className="p-2 text-gray-600 hover:text-white transition-colors" title="Edit">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => deleteFilter(f.id)}
                    className="p-2 text-gray-600 hover:text-red-400 transition-colors" title="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {expandedPrompt === f.id && (
                <div className="mt-3 bg-gray-800 rounded-xl p-3">
                  <p className="text-gray-400 text-xs font-medium mb-1.5">Prompt</p>
                  <p className="text-gray-300 text-xs leading-relaxed">{f.prompt}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
