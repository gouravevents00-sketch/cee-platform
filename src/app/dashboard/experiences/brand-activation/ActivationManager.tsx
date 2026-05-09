'use client'

import { useState, useRef } from 'react'
import {
  Plus, Pencil, Trash2, ExternalLink, ArrowLeft,
  ToggleLeft, ToggleRight, Upload, X, Users, ChevronDown, ChevronUp,
} from 'lucide-react'
import Link from 'next/link'

interface BrandConfig {
  id: string
  name: string
  brand_name: string
  tagline: string
  primary_color: string
  secondary_color: string
  logo_data_url: string | null
  frame_style: 'strip' | 'polaroid' | 'corner'
  active: boolean
  sort_order: number
  created_at: string
}

type FormState = Omit<BrandConfig, 'id' | 'sort_order' | 'created_at'>

const EMPTY: FormState = {
  name: '', brand_name: '', tagline: '', primary_color: '#1a1a2e',
  secondary_color: '#ffffff', logo_data_url: null, frame_style: 'strip', active: true,
}

const FRAME_LABELS = { strip: 'Brand Strip', polaroid: 'Polaroid', corner: 'Corner Logo' }

function compressLogo(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const MAX = 320
        const scale = Math.min(MAX / img.width, MAX / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        res(canvas.toDataURL('image/png', 0.9))
      }
      img.onerror = rej
      img.src = e.target?.result as string
    }
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

export default function ActivationManager({ initialConfigs }: { initialConfigs: BrandConfig[] }) {
  const [configs, setConfigs] = useState<BrandConfig[]>(initialConfigs)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [expandedLeads, setExpandedLeads] = useState<string | null>(null)
  const [leads, setLeads] = useState<Record<string, { count: number; loaded: boolean }>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  function openNew() { setForm(EMPTY); setEditingId('new') }
  function openEdit(c: BrandConfig) {
    setForm({ name: c.name, brand_name: c.brand_name, tagline: c.tagline, primary_color: c.primary_color,
      secondary_color: c.secondary_color, logo_data_url: c.logo_data_url, frame_style: c.frame_style, active: c.active })
    setEditingId(c.id)
  }
  function cancel() { setEditingId(null); setForm(EMPTY) }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await compressLogo(file)
      setForm(p => ({ ...p, logo_data_url: dataUrl }))
    } catch {
      alert('Failed to process logo image')
    }
  }

  async function save() {
    if (!form.name.trim() || !form.brand_name.trim()) return
    setSaving(true)
    try {
      if (editingId === 'new') {
        const res = await fetch('/api/brand-activation/configs', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, sort_order: configs.length }),
        })
        const { config } = await res.json()
        setConfigs(prev => [...prev, config])
      } else {
        const res = await fetch(`/api/brand-activation/configs/${editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form }),
        })
        const { config } = await res.json()
        setConfigs(prev => prev.map(c => c.id === editingId ? config : c))
      }
      cancel()
    } finally { setSaving(false) }
  }

  async function toggleActive(c: BrandConfig) {
    const res = await fetch(`/api/brand-activation/configs/${c.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...c, active: !c.active }),
    })
    const { config } = await res.json()
    setConfigs(prev => prev.map(x => x.id === c.id ? config : x))
  }

  async function deleteConfig(id: string) {
    if (!confirm('Delete this activation config? Leads will remain in DB but unlinked.')) return
    await fetch(`/api/brand-activation/configs/${id}`, { method: 'DELETE' })
    setConfigs(prev => prev.filter(c => c.id !== id))
  }

  async function loadLeads(id: string) {
    if (expandedLeads === id) { setExpandedLeads(null); return }
    setExpandedLeads(id)
    if (leads[id]?.loaded) return
    const res = await fetch(`/api/brand-activation/leads?config_id=${id}`)
    const { leads: data } = await res.json()
    setLeads(prev => ({ ...prev, [id]: { count: data?.length ?? 0, loaded: true } }))
  }

  function launchStation(id: string) {
    window.open(`/brand-station?config=${id}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/experiences" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-white text-xl font-bold">Brand Activation Station</h1>
          <p className="text-gray-500 text-sm">Manage brand configs — each event gets its own station</p>
        </div>
        <button onClick={openNew}
          className="ml-auto flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">
          <Plus size={15} /> New Config
        </button>
      </div>

      {/* Add/Edit Form */}
      {editingId && (
        <div className="bg-gray-900 border border-amber-500/30 rounded-2xl p-5 space-y-4">
          <h2 className="text-white font-semibold text-sm">{editingId === 'new' ? 'New Brand Config' : 'Edit Config'}</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Activation Name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. HDFC Annual Day 2025"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Brand Name</label>
              <input value={form.brand_name} onChange={e => setForm(p => ({ ...p, brand_name: e.target.value }))}
                placeholder="e.g. HDFC Bank"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1.5">Tagline (optional)</label>
            <input value={form.tagline} onChange={e => setForm(p => ({ ...p, tagline: e.target.value }))}
              placeholder="e.g. We Understand Your World"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Primary Color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={form.primary_color} onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                  className="h-10 w-12 rounded-lg border border-gray-700 bg-gray-800 cursor-pointer" />
                <input value={form.primary_color} onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 font-mono" />
              </div>
              <p className="text-gray-600 text-xs mt-1">Background / frame color</p>
            </div>
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Text Color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={form.secondary_color} onChange={e => setForm(p => ({ ...p, secondary_color: e.target.value }))}
                  className="h-10 w-12 rounded-lg border border-gray-700 bg-gray-800 cursor-pointer" />
                <input value={form.secondary_color} onChange={e => setForm(p => ({ ...p, secondary_color: e.target.value }))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 font-mono" />
              </div>
              <p className="text-gray-600 text-xs mt-1">Logo text / tagline color</p>
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1.5">Frame Style</label>
            <div className="grid grid-cols-3 gap-2">
              {(['strip', 'polaroid', 'corner'] as const).map(style => (
                <button key={style} onClick={() => setForm(p => ({ ...p, frame_style: style }))}
                  className={`py-2.5 rounded-xl text-xs font-medium transition-colors ${
                    form.frame_style === style ? 'bg-amber-500 text-black' : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}>
                  {FRAME_LABELS[style]}
                </button>
              ))}
            </div>
            <p className="text-gray-600 text-xs mt-1.5">
              Strip = brand bar at bottom · Polaroid = white mat + brand below · Corner = logo corners only
            </p>
          </div>

          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1.5">Brand Logo</label>
            {form.logo_data_url ? (
              <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.logo_data_url} alt="Logo preview" className="h-12 w-auto object-contain rounded" />
                <div className="flex-1">
                  <p className="text-white text-xs font-medium">Logo uploaded</p>
                  <p className="text-gray-500 text-xs">~{Math.round(form.logo_data_url.length / 1024)}KB</p>
                </div>
                <button onClick={() => setForm(p => ({ ...p, logo_data_url: null }))}
                  className="p-1.5 text-gray-500 hover:text-red-400 transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 border border-dashed border-gray-600 hover:border-amber-500 text-gray-400 hover:text-white rounded-xl py-4 text-sm transition-all">
                <Upload size={16} /> Upload Logo (PNG recommended)
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={cancel} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-5 py-2.5 rounded-xl text-sm transition-colors">
              Cancel
            </button>
            <button onClick={save} disabled={saving || !form.name.trim() || !form.brand_name.trim()}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold px-6 py-2.5 rounded-xl text-sm transition-all">
              {saving ? 'Saving...' : editingId === 'new' ? 'Create Config' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Config List */}
      {configs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-600 text-sm">No brand configs yet.</p>
          <button onClick={openNew} className="mt-3 text-amber-500 text-sm hover:text-amber-400 transition-colors">
            + Create your first activation
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map(c => (
            <div key={c.id}
              className={`bg-gray-900 border rounded-2xl p-4 transition-all ${c.active ? 'border-gray-800' : 'border-gray-800/40 opacity-50'}`}>
              <div className="flex items-center gap-3">
                {/* Color swatch + logo */}
                <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
                  style={{ background: c.primary_color }}>
                  {c.logo_data_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.logo_data_url} alt={c.brand_name} className="w-8 h-8 object-contain" />
                    : <span className="text-xs font-bold" style={{ color: c.secondary_color }}>{c.brand_name.slice(0, 2).toUpperCase()}</span>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm">{c.brand_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">{FRAME_LABELS[c.frame_style]}</span>
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">{c.name}</p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => loadLeads(c.id)}
                    className="p-2 text-gray-600 hover:text-gray-300 transition-colors" title="View leads">
                    {expandedLeads === c.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  <button onClick={() => launchStation(c.id)}
                    className="p-2 text-gray-600 hover:text-amber-400 transition-colors" title="Launch Station">
                    <ExternalLink size={15} />
                  </button>
                  <button onClick={() => toggleActive(c)}
                    className="p-2 text-gray-600 hover:text-amber-400 transition-colors" title="Toggle active">
                    {c.active ? <ToggleRight size={18} className="text-green-400" /> : <ToggleLeft size={18} />}
                  </button>
                  <button onClick={() => openEdit(c)}
                    className="p-2 text-gray-600 hover:text-white transition-colors" title="Edit">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => deleteConfig(c.id)}
                    className="p-2 text-gray-600 hover:text-red-400 transition-colors" title="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Station URL */}
              <div className="mt-3 flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2">
                <span className="text-gray-500 text-xs font-mono flex-1 truncate">
                  /brand-station?config={c.id}
                </span>
                <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/brand-station?config=${c.id}`)}
                  className="text-gray-600 hover:text-amber-400 text-xs transition-colors flex-shrink-0">
                  Copy URL
                </button>
              </div>

              {/* Leads panel */}
              {expandedLeads === c.id && (
                <div className="mt-3 bg-gray-800 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={13} className="text-gray-400" />
                    <p className="text-gray-400 text-xs font-medium">
                      {leads[c.id]?.loaded ? `${leads[c.id].count} leads captured` : 'Loading...'}
                    </p>
                  </div>
                  {leads[c.id]?.loaded && (
                    <a href={`/api/brand-activation/leads?config_id=${c.id}`} target="_blank" rel="noopener noreferrer"
                      className="text-amber-400 text-xs hover:text-amber-300 transition-colors">
                      Download leads JSON →
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
