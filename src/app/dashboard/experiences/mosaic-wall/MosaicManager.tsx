'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Plus, Pencil, Trash2, ExternalLink, ArrowLeft,
  ToggleLeft, ToggleRight, Upload, X, Download,
  Monitor, Camera, Copy, LayoutGrid,
} from 'lucide-react'
import Link from 'next/link'

interface MosaicSession {
  id: string
  name: string
  brand_name: string
  tagline: string
  logo_data_url: string | null
  primary_color: string
  secondary_color: string
  master_image_url: string | null
  grid_cols: number
  grid_rows: number
  active: boolean
  created_at: string
}

type FormState = Omit<MosaicSession, 'id' | 'created_at'>

const EMPTY: FormState = {
  name: '', brand_name: '', tagline: '',
  logo_data_url: null, primary_color: '#0f172a', secondary_color: '#ffffff',
  master_image_url: null, grid_cols: 20, grid_rows: 12, active: true,
}

const GRID_PRESETS = [
  { label: '10×8 — 80 tiles (small, ~80 guests)', cols: 10, rows: 8 },
  { label: '15×10 — 150 tiles (~150 guests)', cols: 15, rows: 10 },
  { label: '20×12 — 240 tiles (~200 guests)', cols: 20, rows: 12 },
  { label: '25×16 — 400 tiles (large events)', cols: 25, rows: 16 },
  { label: '30×20 — 600 tiles (mega events)', cols: 30, rows: 20 },
]

function compressImage(file: File, maxW: number, maxH: number, quality = 0.88): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(maxW / img.width, maxH / img.height, 1)
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        res(c.toDataURL('image/jpeg', quality))
      }
      img.onerror = rej
      img.src = e.target?.result as string
    }
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

export default function MosaicManager({ initialSessions }: { initialSessions: MosaicSession[] }) {
  const [sessions, setSessions]     = useState<MosaicSession[]>(initialSessions)
  const [selectedId, setSelectedId] = useState<string>(initialSessions[0]?.id ?? '')
  const [editingId, setEditingId]   = useState<string | 'new' | null>(null)
  const [form, setForm]             = useState<FormState>(EMPTY)
  const [saving, setSaving]         = useState(false)
  const [uploadingMaster, setUploadingMaster] = useState(false)
  const [uploadingLogo, setUploadingLogo]     = useState(false)
  const [tileCounts, setTileCounts] = useState<Record<string, number>>({})
  const [copiedUrl, setCopiedUrl]   = useState<string | null>(null)
  const logoRef   = useRef<HTMLInputElement>(null)
  const masterRef = useRef<HTMLInputElement>(null)

  const activeSessions = sessions.filter(s => s.active)
  const selected = sessions.find(s => s.id === selectedId) ?? activeSessions[0]

  // Load tile counts for all sessions
  useEffect(() => {
    sessions.forEach(s => {
      if (tileCounts[s.id] !== undefined) return
      fetch(`/api/mosaic/sessions/${s.id}/tiles`)
        .then(r => r.json())
        .then(({ tiles }) => setTileCounts(prev => ({ ...prev, [s.id]: tiles?.length ?? 0 })))
        .catch(() => {})
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions])

  function openNew() { setForm(EMPTY); setEditingId('new') }
  function openEdit(s: MosaicSession) {
    setForm({
      name: s.name, brand_name: s.brand_name, tagline: s.tagline,
      logo_data_url: s.logo_data_url, primary_color: s.primary_color,
      secondary_color: s.secondary_color, master_image_url: s.master_image_url,
      grid_cols: s.grid_cols, grid_rows: s.grid_rows, active: s.active,
    })
    setEditingId(s.id)
  }
  function cancel() { setEditingId(null); setForm(EMPTY) }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const dataUrl = await compressImage(file, 320, 320, 0.9)
      setForm(p => ({ ...p, logo_data_url: dataUrl }))
    } catch { alert('Logo upload failed') }
    finally { setUploadingLogo(false) }
  }

  async function handleMasterUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingMaster(true)
    try {
      // Compress to max 1920×1080 for display
      const dataUrl = await compressImage(file, 1920, 1080, 0.9)
      // Upload to storage if we have a session ID, otherwise keep as dataUrl temporarily
      if (editingId && editingId !== 'new') {
        const base64 = dataUrl.split(',')[1]
        const res = await fetch('/api/mosaic/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: base64, session_id: editingId, bucket: 'masters' }),
        })
        const { url } = await res.json()
        setForm(p => ({ ...p, master_image_url: url }))
      } else {
        // For new session, we'll upload after save — store as dataUrl temporarily
        setForm(p => ({ ...p, master_image_url: dataUrl }))
      }
    } catch { alert('Master image upload failed') }
    finally { setUploadingMaster(false) }
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      let masterUrl = form.master_image_url

      // If master is still a dataUrl (new session), upload it first
      if (masterUrl?.startsWith('data:')) {
        const base64 = masterUrl.split(',')[1]
        const res = await fetch('/api/mosaic/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: base64, session_id: 'new', bucket: 'masters' }),
        })
        const { url } = await res.json()
        masterUrl = url
      }

      const payload = { ...form, master_image_url: masterUrl }

      if (editingId === 'new') {
        const res = await fetch('/api/mosaic/sessions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const { session } = await res.json()
        setSessions(prev => [session, ...prev])
        setSelectedId(session.id)
      } else {
        const res = await fetch(`/api/mosaic/sessions/${editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const { session } = await res.json()
        setSessions(prev => prev.map(s => s.id === editingId ? session : s))
      }
      cancel()
    } finally { setSaving(false) }
  }

  async function toggleActive(s: MosaicSession) {
    const res = await fetch(`/api/mosaic/sessions/${s.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...s, active: !s.active }),
    })
    const { session } = await res.json()
    setSessions(prev => prev.map(x => x.id === s.id ? session : x))
  }

  async function deleteSession(id: string) {
    if (!confirm('Delete this mosaic session? All tile photos will be removed.')) return
    await fetch(`/api/mosaic/sessions/${id}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== id))
    if (selectedId === id) setSelectedId(sessions.find(s => s.id !== id)?.id ?? '')
  }

  function copyUrl(url: string, key: string) {
    navigator.clipboard.writeText(url)
    setCopiedUrl(key)
    setTimeout(() => setCopiedUrl(null), 1500)
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/experiences" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            <LayoutGrid size={18} className="text-indigo-400" /> Photo Mosaic Wall
          </h1>
          <p className="text-gray-500 text-sm">Guest selfies build a giant mosaic in real-time — displayed on screen at the event</p>
        </div>
      </div>

      {/* ── Operator Launch Panel ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-semibold text-sm">Launch Station</h2>

        {activeSessions.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm">No active sessions yet.</p>
            <button onClick={openNew} className="mt-2 text-amber-400 text-sm hover:text-amber-300 transition-colors">
              + Create your first mosaic session below
            </button>
          </div>
        ) : (
          <>
            {activeSessions.length > 1 && (
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1.5">Select Session</label>
                <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500">
                  {activeSessions.map(s => <option key={s.id} value={s.id}>{s.brand_name ? `${s.brand_name} — ` : ''}{s.name}</option>)}
                </select>
              </div>
            )}

            {selected && (
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                {/* Session summary */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden"
                    style={{ background: selected.primary_color }}>
                    {selected.master_image_url && !selected.master_image_url.startsWith('data:')
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={selected.master_image_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <LayoutGrid size={20} style={{ color: selected.secondary_color }} />
                        </div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold">{selected.brand_name || selected.name}</p>
                    <p className="text-gray-400 text-sm">{selected.grid_cols}×{selected.grid_rows} grid = {selected.grid_cols * selected.grid_rows} tiles</p>
                    {!selected.master_image_url && (
                      <p className="text-amber-400 text-xs mt-0.5">⚠ No master image — upload one to show the mosaic effect</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-white">{tileCounts[selected.id] ?? '—'}</p>
                    <p className="text-gray-500 text-xs">/ {selected.grid_cols * selected.grid_rows} tiles</p>
                  </div>
                </div>

                {/* Progress bar */}
                {tileCounts[selected.id] !== undefined && (
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (tileCounts[selected.id] / (selected.grid_cols * selected.grid_rows)) * 100)}%` }} />
                  </div>
                )}

                {/* URLs */}
                <div className="space-y-1.5">
                  {[
                    { label: 'Capture Station', url: `${origin}/mosaic-capture?session=${selected.id}`, key: 'capture' },
                    { label: 'Wall Display', url: `${origin}/mosaic-display?session=${selected.id}`, key: 'display' },
                  ].map(({ label, url, key }) => (
                    <div key={key} className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2">
                      <span className="text-gray-400 text-xs w-24 flex-shrink-0">{label}:</span>
                      <span className="text-gray-300 text-xs font-mono flex-1 truncate">{url.replace(origin, '')}</span>
                      <button onClick={() => copyUrl(url, key)}
                        className="text-xs text-amber-400 hover:text-amber-300 flex-shrink-0 transition-colors">
                        {copiedUrl === key ? 'Copied!' : <Copy size={11} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Launch buttons */}
            {selected && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => window.open(`/mosaic-capture?session=${selected.id}`, '_blank', 'noopener,noreferrer')}
                  className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl text-sm transition-all border border-gray-700 active:scale-95">
                  <Camera size={15} /> Capture Station
                </button>
                <button
                  onClick={() => window.open(`/mosaic-display?session=${selected.id}`, '_blank', 'noopener,noreferrer')}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm transition-all active:scale-95">
                  <Monitor size={15} /> Wall Display
                </button>
              </div>
            )}

            {selected && (
              <a href={`/api/mosaic/sessions/${selected.id}/export`} download
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl text-sm transition-colors">
                <Download size={14} /> Export Participants CSV
              </a>
            )}
          </>
        )}
      </div>

      {/* ── Sessions Management ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">Sessions</h2>
          <button onClick={openNew}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-xl text-xs transition-all">
            <Plus size={13} /> New Session
          </button>
        </div>

        {/* Form */}
        {editingId && (
          <div className="bg-gray-900 border border-amber-500/30 rounded-2xl p-5 space-y-4">
            <h3 className="text-white font-semibold text-sm">{editingId === 'new' ? 'New Session' : 'Edit Session'}</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1.5">Session Name</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. HDFC Annual Day Mosaic"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1.5">Brand Name (optional)</label>
                <input value={form.brand_name} onChange={e => setForm(p => ({ ...p, brand_name: e.target.value }))}
                  placeholder="e.g. HDFC Bank"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Tagline (shown on display)</label>
              <input value={form.tagline} onChange={e => setForm(p => ({ ...p, tagline: e.target.value }))}
                placeholder="e.g. Together we make the picture"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>

            {/* Master image upload */}
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">
                Master Mosaic Image <span className="text-gray-600">(the picture guests will recreate together)</span>
              </label>
              {form.master_image_url ? (
                <div className="relative rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.master_image_url} alt="Master" className="w-full h-40 object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-3">
                    <button onClick={() => masterRef.current?.click()}
                      className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs rounded-lg transition-colors">
                      Change
                    </button>
                    <button onClick={() => setForm(p => ({ ...p, master_image_url: null }))}
                      className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => masterRef.current?.click()} disabled={uploadingMaster}
                  className="w-full flex flex-col items-center justify-center gap-2 bg-gray-800 border-2 border-dashed border-gray-600 hover:border-indigo-500 text-gray-400 hover:text-white rounded-xl py-8 text-sm transition-all">
                  <Upload size={24} className={uploadingMaster ? 'animate-bounce' : ''} />
                  <span>{uploadingMaster ? 'Uploading...' : 'Upload Master Image'}</span>
                  <span className="text-gray-600 text-xs">Brand logo, event poster, celebrity face — the mosaic will recreate this</span>
                </button>
              )}
              <input ref={masterRef} type="file" accept="image/*" onChange={handleMasterUpload} className="hidden" />
            </div>

            {/* Grid preset */}
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Grid Size</label>
              <div className="space-y-1.5">
                {GRID_PRESETS.map(p => (
                  <button key={`${p.cols}x${p.rows}`}
                    onClick={() => setForm(prev => ({ ...prev, grid_cols: p.cols, grid_rows: p.rows }))}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      form.grid_cols === p.cols && form.grid_rows === p.rows
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-3">
              {([['primary_color', 'Background Color'], ['secondary_color', 'Text Color']] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="text-gray-400 text-xs font-medium block mb-1.5">{label}</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      className="h-10 w-12 rounded-lg border border-gray-700 bg-gray-800 cursor-pointer" />
                    <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 font-mono" />
                  </div>
                </div>
              ))}
            </div>

            {/* Logo */}
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Brand Logo (shown on display wall)</label>
              {form.logo_data_url ? (
                <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logo_data_url} alt="Logo" className="h-10 w-auto object-contain rounded" />
                  <div className="flex-1"><p className="text-white text-xs font-medium">Logo uploaded</p></div>
                  <button onClick={() => setForm(p => ({ ...p, logo_data_url: null }))}
                    className="p-1.5 text-gray-500 hover:text-red-400"><X size={14} /></button>
                </div>
              ) : (
                <button onClick={() => logoRef.current?.click()} disabled={uploadingLogo}
                  className="w-full flex items-center justify-center gap-2 bg-gray-800 border border-dashed border-gray-600 hover:border-amber-500 text-gray-400 hover:text-white rounded-xl py-4 text-sm transition-all">
                  <Upload size={15} /> {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </button>
              )}
              <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={cancel} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-5 py-2.5 rounded-xl text-sm transition-colors">Cancel</button>
              <button onClick={save} disabled={saving || !form.name.trim()}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold px-6 py-2.5 rounded-xl text-sm transition-all">
                {saving ? 'Saving...' : editingId === 'new' ? 'Create Session' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Sessions list */}
        {sessions.length === 0 && !editingId && (
          <p className="text-center py-12 text-gray-600 text-sm">No sessions yet.</p>
        )}
        <div className="space-y-2">
          {sessions.map(s => {
            const total = s.grid_cols * s.grid_rows
            const filled = tileCounts[s.id] ?? 0
            const pct = Math.round((filled / total) * 100)
            return (
              <div key={s.id}
                className={`bg-gray-900 border rounded-2xl p-4 transition-all ${s.active ? 'border-gray-800' : 'border-gray-800/30 opacity-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden"
                    style={{ background: s.primary_color }}>
                    {s.master_image_url && !s.master_image_url.startsWith('data:')
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={s.master_image_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <LayoutGrid size={16} style={{ color: s.secondary_color }} />
                        </div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-semibold text-sm">{s.brand_name || s.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.active ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                        {s.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-gray-500 text-xs flex-shrink-0">{filled}/{total}</span>
                    </div>
                    <p className="text-gray-600 text-xs mt-0.5">{s.grid_cols}×{s.grid_rows} · {s.name}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleActive(s)} className="p-2 text-gray-600 hover:text-amber-400 transition-colors">
                      {s.active ? <ToggleRight size={18} className="text-green-400" /> : <ToggleLeft size={18} />}
                    </button>
                    <button onClick={() => openEdit(s)} className="p-2 text-gray-600 hover:text-white transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => window.open(`/mosaic-display?session=${s.id}`, '_blank')}
                      className="p-2 text-gray-600 hover:text-indigo-400 transition-colors" title="Wall Display">
                      <ExternalLink size={15} />
                    </button>
                    <button onClick={() => deleteSession(s.id)} className="p-2 text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
