'use client'

import { useState, useRef } from 'react'
import {
  Plus, Pencil, Trash2, ExternalLink, ArrowLeft,
  ToggleLeft, ToggleRight, Upload, X, Download,
  ChevronDown, ChevronUp, Copy, Megaphone,
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
  scene_prompt: string | null
  active: boolean
  sort_order: number
}

type FormState = Omit<BrandConfig, 'id' | 'sort_order'>

const EMPTY: FormState = {
  name: '', brand_name: '', tagline: '',
  primary_color: '#1a1a2e', secondary_color: '#ffffff',
  logo_data_url: null, frame_style: 'strip',
  scene_prompt: '', active: true,
}

const FRAME_LABELS = { strip: 'Brand Strip', polaroid: 'Polaroid', corner: 'Corner' }

const SCENE_EXAMPLES = [
  'Person standing in a premium brand showroom, brand products displayed prominently, luxury interior, professional marketing photography',
  'Person holding a cold beverage can with stadium crowd cheering in background, brand colors everywhere, action photography',
  'Person in formal corporate environment with brand logo visible on backdrop, confident business pose, editorial quality',
  'Person at a festive brand stall decorated with brand colors and balloons, candid joyful expression, event photography',
]

function compressLogo(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const MAX = 320
        const scale = Math.min(MAX / img.width, MAX / img.height, 1)
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        res(c.toDataURL('image/png', 0.9))
      }
      img.onerror = rej
      img.src = e.target?.result as string
    }
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

export default function ActivationManager({ initialConfigs }: { initialConfigs: BrandConfig[] }) {
  const [configs, setConfigs]       = useState<BrandConfig[]>(initialConfigs)
  const [selectedId, setSelectedId] = useState<string>(initialConfigs[0]?.id ?? '')
  const [editingId, setEditingId]   = useState<string | 'new' | null>(null)
  const [form, setForm]             = useState<FormState>(EMPTY)
  const [saving, setSaving]         = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copied, setCopied]         = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const activeConfigs = configs.filter(c => c.active)
  const selected = configs.find(c => c.id === selectedId) ?? activeConfigs[0]

  function openNew() { setForm(EMPTY); setEditingId('new') }
  function openEdit(c: BrandConfig) {
    setForm({
      name: c.name, brand_name: c.brand_name, tagline: c.tagline,
      primary_color: c.primary_color, secondary_color: c.secondary_color,
      logo_data_url: c.logo_data_url, frame_style: c.frame_style,
      scene_prompt: c.scene_prompt ?? '', active: c.active,
    })
    setEditingId(c.id)
  }
  function cancel() { setEditingId(null); setForm(EMPTY) }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const d = await compressLogo(file)
      setForm(p => ({ ...p, logo_data_url: d }))
    } catch { alert('Failed to process logo') }
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
        setSelectedId(config.id)
      } else {
        const res = await fetch(`/api/brand-activation/configs/${editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
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
    if (!confirm('Delete this brand config? Cannot be undone.')) return
    await fetch(`/api/brand-activation/configs/${id}`, { method: 'DELETE' })
    setConfigs(prev => prev.filter(c => c.id !== id))
    if (selectedId === id) setSelectedId(configs.find(c => c.id !== id)?.id ?? '')
  }

  function copyUrl(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/brand-station?config=${id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/experiences" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            <Megaphone size={18} className="text-red-400" /> Brand Activation Station
          </h1>
          <p className="text-gray-500 text-sm">AI places guests inside your brand's world — faces preserved, scene transformed</p>
        </div>
      </div>

      {/* ── Operator Launch Panel ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-semibold text-sm">Launch Station</h2>

        {activeConfigs.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm">No active brand configs yet.</p>
            <button onClick={openNew} className="mt-2 text-amber-400 text-sm hover:text-amber-300 transition-colors">
              + Create your first brand config below
            </button>
          </div>
        ) : (
          <>
            {activeConfigs.length > 1 && (
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1.5">Select Brand / Event</label>
                <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500">
                  {activeConfigs.map(c => (
                    <option key={c.id} value={c.id}>{c.brand_name} — {c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {selected && (
              <div className="flex items-center gap-4 bg-gray-800 rounded-xl p-4">
                <div className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
                  style={{ background: selected.primary_color }}>
                  {selected.logo_data_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={selected.logo_data_url} alt="" className="w-12 h-12 object-contain" />
                    : <span className="text-lg font-black" style={{ color: selected.secondary_color }}>
                        {selected.brand_name.slice(0, 2).toUpperCase()}
                      </span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold">{selected.brand_name}</p>
                  <p className="text-gray-400 text-sm">{selected.name}</p>
                  {selected.tagline && <p className="text-gray-500 text-xs mt-0.5 italic">"{selected.tagline}"</p>}
                  {!selected.scene_prompt && (
                    <p className="text-amber-400 text-xs mt-1">⚠ No AI scene prompt — add one below before launching</p>
                  )}
                </div>
              </div>
            )}

            {selected && (
              <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2.5">
                <span className="text-gray-500 text-xs font-mono flex-1 truncate">
                  /brand-station?config={selected.id}
                </span>
                <button onClick={() => copyUrl(selected.id)}
                  className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors flex-shrink-0">
                  <Copy size={12} /> {copied ? 'Copied!' : 'Copy URL'}
                </button>
              </div>
            )}

            {selected && (
              <button
                onClick={() => window.open(`/brand-station?config=${selected.id}`, '_blank', 'noopener,noreferrer')}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-black font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20">
                <ExternalLink size={16} /> Launch Brand Station
              </button>
            )}

            {selected && (
              <a href={`/api/brand-activation/leads/export?config_id=${selected.id}`} download
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl text-sm transition-colors">
                <Download size={14} /> Export Leads as CSV
              </a>
            )}
          </>
        )}
      </div>

      {/* ── Manage Brand Configs ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">Brand Configs</h2>
          <button onClick={openNew}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-xl text-xs transition-all">
            <Plus size={13} /> Add Config
          </button>
        </div>

        {/* Add/Edit Form */}
        {editingId && (
          <div className="bg-gray-900 border border-amber-500/30 rounded-2xl p-5 space-y-4">
            <h3 className="text-white font-semibold text-sm">{editingId === 'new' ? 'New Brand Config' : 'Edit Config'}</h3>

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

            {/* AI Scene Prompt — most critical field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-gray-400 text-xs font-medium">AI Brand Scene Prompt</label>
                <span className="text-gray-600 text-xs">{(form.scene_prompt ?? '').length} chars</span>
              </div>
              <textarea value={form.scene_prompt ?? ''} onChange={e => setForm(p => ({ ...p, scene_prompt: e.target.value }))}
                placeholder="Describe the brand scene — where does the guest appear, what surrounds them, what mood/setting"
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600 resize-none" />
              <div className="mt-2">
                <p className="text-gray-600 text-xs mb-1.5">Examples (click to use):</p>
                <div className="space-y-1">
                  {SCENE_EXAMPLES.map((ex, i) => (
                    <button key={i} onClick={() => setForm(p => ({ ...p, scene_prompt: ex }))}
                      className="block w-full text-left text-gray-600 hover:text-gray-300 text-xs bg-gray-800/50 hover:bg-gray-800 px-2.5 py-1.5 rounded-lg transition-colors">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-3">
              {([['primary_color', 'Brand Color', 'Background / frame color'], ['secondary_color', 'Text Color', 'Brand name & tagline']] as const).map(([key, label, hint]) => (
                <div key={key}>
                  <label className="text-gray-400 text-xs font-medium block mb-1.5">{label}</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      className="h-10 w-12 rounded-lg border border-gray-700 bg-gray-800 cursor-pointer" />
                    <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 font-mono" />
                  </div>
                  <p className="text-gray-600 text-xs mt-1">{hint}</p>
                </div>
              ))}
            </div>

            {/* Frame style */}
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Frame Style (applied on top of AI photo)</label>
              <div className="grid grid-cols-3 gap-2">
                {(['strip', 'polaroid', 'corner'] as const).map(s => (
                  <button key={s} onClick={() => setForm(p => ({ ...p, frame_style: s }))}
                    className={`py-2.5 rounded-xl text-xs font-medium transition-colors ${
                      form.frame_style === s ? 'bg-amber-500 text-black' : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                    {FRAME_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Logo */}
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Brand Logo</label>
              {form.logo_data_url ? (
                <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logo_data_url} alt="Logo" className="h-12 w-auto object-contain rounded" />
                  <div className="flex-1">
                    <p className="text-white text-xs font-medium">Logo uploaded</p>
                    <p className="text-gray-500 text-xs">~{Math.round(form.logo_data_url.length / 1024)}KB</p>
                  </div>
                  <button onClick={() => setForm(p => ({ ...p, logo_data_url: null }))}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"><X size={14} /></button>
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

        {/* Config list */}
        {configs.length === 0 && !editingId && (
          <div className="text-center py-12 text-gray-600 text-sm">No brand configs yet.</div>
        )}
        <div className="space-y-2">
          {configs.map(c => (
            <div key={c.id}
              className={`bg-gray-900 border rounded-2xl p-4 transition-all ${c.active ? 'border-gray-800' : 'border-gray-800/30 opacity-50'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
                  style={{ background: c.primary_color }}>
                  {c.logo_data_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.logo_data_url} alt="" className="w-9 h-9 object-contain" />
                    : <span className="text-xs font-black" style={{ color: c.secondary_color }}>{c.brand_name.slice(0, 2).toUpperCase()}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold text-sm">{c.brand_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                    {!c.scene_prompt && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">No AI prompt</span>}
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5 truncate">{c.name}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    className="p-2 text-gray-600 hover:text-gray-300 transition-colors">
                    {expandedId === c.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  <button onClick={() => toggleActive(c)} className="p-2 text-gray-600 hover:text-amber-400 transition-colors">
                    {c.active ? <ToggleRight size={18} className="text-green-400" /> : <ToggleLeft size={18} />}
                  </button>
                  <button onClick={() => openEdit(c)} className="p-2 text-gray-600 hover:text-white transition-colors">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => deleteConfig(c.id)} className="p-2 text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {expandedId === c.id && (
                <div className="mt-3 bg-gray-800 rounded-xl p-3 space-y-2">
                  <div>
                    <p className="text-gray-500 text-xs font-medium mb-1">AI Brand Scene Prompt</p>
                    <p className="text-gray-300 text-xs leading-relaxed">
                      {c.scene_prompt || <span className="text-amber-400 not-italic">Not set — edit to add AI prompt</span>}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-gray-700">
                    <span className="text-gray-600 text-xs">Frame: {FRAME_LABELS[c.frame_style]}</span>
                    <a href={`/api/brand-activation/leads/export?config_id=${c.id}`} download
                      className="flex items-center gap-1 text-amber-400 text-xs hover:text-amber-300 transition-colors">
                      <Download size={11} /> Export leads
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
