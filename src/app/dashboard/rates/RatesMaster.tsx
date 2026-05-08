'use client'

import { useState, useRef } from 'react'
import { Upload, Plus, Trash2, Save, Download, Check, AlertCircle } from 'lucide-react'

interface Rate {
  id?: string
  category: string
  item_name: string
  specification: string
  unit: string
  our_cost: number
  our_rate: number
  notes: string
}

const CATEGORIES = [
  'Sound & AV', 'Lighting', 'Stage & Set', 'LED & Visual',
  'Branding', 'Fabrication', 'Tentage', 'Manpower',
  'Transport', 'Power', 'Decor', 'Catering', 'Other',
]

const UNITS = [
  'per day', 'per sq.ft', 'per sq.ft per day', 'per piece',
  'per piece per day', 'per trip', 'per person per day',
  'per event', 'unit',
]

const TEMPLATE_CSV = `Category,Item Name,Specification,Unit,Our Cost,Our Rate,Notes
Sound & AV,PA System 8KW,Line Array 2 stacks,per day,15000,22000,
Sound & AV,PA System 15KW,Line Array 4 stacks,per day,28000,40000,
Sound & AV,Microphone Wireless,Shure/Sennheiser,per piece per day,500,1200,
Lighting,Beam Moving Head 230W,,per piece per day,700,1500,
Lighting,LED Wash 150W,,per piece per day,400,900,
Lighting,Follow Spot 1200W,,per piece per day,2500,4000,
Stage & Set,Stage Platform,Wooden frame carpet top,per sq.ft,45,90,
Stage & Set,Backdrop Fabric,Printed flex,per sq.ft,35,75,
LED & Visual,LED Screen Indoor,P3.9 panel,per sq.ft per day,180,350,
LED & Visual,LED Screen Outdoor,P6 panel,per sq.ft per day,220,420,
LED & Visual,Projector 10000 Lumen,With screen,per day,8000,14000,
Branding,Standee Flex Print,2x5 ft,per piece,250,500,
Branding,Roll-Up Banner,1x2 m,per piece,600,1200,
Branding,Vinyl Wrap,,per sq.ft,18,40,
Fabrication,Entrance Gate,MDF painted,per sq.ft,80,160,
Fabrication,Photo Wall,MDF frame,per sq.ft,70,140,
Tentage,Swiss Cottage Tent,,per sq.ft,30,65,
Tentage,Marquee Tent,,per sq.ft,25,55,
Manpower,Event Manager,,per person per day,1800,3000,
Manpower,Coordinator,,per person per day,1200,2000,
Manpower,Helper Labour,,per person per day,600,1200,
Transport,407 Tempo,,per trip,4500,8000,
Transport,Tata Ace,,per trip,2500,4500,
Power,Genset 62.5 KVA,,per day,6000,10000,
Power,Genset 125 KVA,,per day,10000,16000,`

export default function RatesMaster({ initialRates }: { initialRates: Rate[] }) {
  const [rates, setRates] = useState<Rate[]>(initialRates)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [uploadMsg, setUploadMsg] = useState('')
  const [filterCat, setFilterCat] = useState('All')
  const [showAddRow, setShowAddRow] = useState(false)
  const [newRow, setNewRow] = useState<Rate>({ category: '', item_name: '', specification: '', unit: 'per day', our_cost: 0, our_rate: 0, notes: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  const categories = ['All', ...Array.from(new Set(rates.map(r => r.category))).sort()]
  const filtered = filterCat === 'All' ? rates : rates.filter(r => r.category === filterCat)

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'CEE_Rate_Master_Template.csv'
    a.click()
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg('')
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/rates', { method: 'POST', body: formData })
    const data = await res.json()
    if (res.ok) {
      setUploadMsg(`✓ ${data.inserted} rates uploaded successfully`)
      // Refresh
      const r = await fetch('/api/rates')
      const d = await r.json()
      setRates(d.rates || [])
    } else {
      setUploadMsg(`Error: ${data.error}`)
    }
    setUploading(false)
    e.target.value = ''
  }

  async function saveRate(rate: Rate) {
    if (!rate.item_name.trim()) return
    setSaving(rate.id || 'new')
    const res = await fetch('/api/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [rate] }),
    })
    if (res.ok) {
      setSaved(rate.id || 'new')
      setTimeout(() => setSaved(null), 2000)
      const r = await fetch('/api/rates')
      const d = await r.json()
      setRates(d.rates || [])
      setShowAddRow(false)
      setNewRow({ category: '', item_name: '', specification: '', unit: 'per day', our_cost: 0, our_rate: 0, notes: '' })
    }
    setSaving(null)
  }

  async function deleteRate(id: string) {
    await fetch('/api/rates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setRates(prev => prev.filter(r => r.id !== id))
  }

  function updateLocalRate(id: string, field: keyof Rate, value: any) {
    setRates(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const margin = (r: Rate) => r.our_rate > 0 ? Math.round((r.our_rate - r.our_cost) / r.our_rate * 100) : 0

  return (
    <div className="space-y-4">

      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 bg-gray-900 border border-gray-700 hover:border-gray-600 text-gray-300 text-sm px-4 py-2 rounded-xl transition-colors"
        >
          <Download size={14} /> Download Template
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
        >
          <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload CSV / Excel'}
        </button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleUpload} className="hidden" />

        <button
          onClick={() => setShowAddRow(v => !v)}
          className="flex items-center gap-2 bg-gray-900 border border-gray-700 hover:border-gray-600 text-gray-300 text-sm px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={14} /> Add Rate
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-gray-500 text-xs">{rates.length} rates</span>
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-xl px-3 py-2 focus:outline-none"
          >
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {uploadMsg && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm ${uploadMsg.startsWith('✓') ? 'bg-green-950 border border-green-800 text-green-400' : 'bg-red-950 border border-red-800 text-red-400'}`}>
          {uploadMsg.startsWith('✓') ? <Check size={14} /> : <AlertCircle size={14} />}
          {uploadMsg}
        </div>
      )}

      {/* Add row form */}
      {showAddRow && (
        <div className="bg-gray-900 border border-amber-700/40 rounded-2xl p-4">
          <p className="text-amber-400 text-xs font-semibold uppercase tracking-wide mb-3">New Rate</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Category</label>
              <select value={newRow.category} onChange={e => setNewRow(p => ({ ...p, category: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500">
                <option value="">Select…</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Item Name *</label>
              <input value={newRow.item_name} onChange={e => setNewRow(p => ({ ...p, item_name: e.target.value }))}
                placeholder="e.g. PA System 8KW"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Specification</label>
              <input value={newRow.specification} onChange={e => setNewRow(p => ({ ...p, specification: e.target.value }))}
                placeholder="Optional"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Unit</label>
              <select value={newRow.unit} onChange={e => setNewRow(p => ({ ...p, unit: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500">
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Our Cost (₹)</label>
              <input type="number" value={newRow.our_cost} onChange={e => setNewRow(p => ({ ...p, our_cost: Number(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-amber-400 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Our Rate (₹)</label>
              <input type="number" value={newRow.our_rate} onChange={e => setNewRow(p => ({ ...p, our_rate: Number(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => saveRate(newRow)} disabled={!newRow.item_name.trim() || saving === 'new'}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-semibold text-sm px-4 py-2 rounded-xl transition-colors">
              <Save size={13} /> {saving === 'new' ? 'Saving…' : 'Save Rate'}
            </button>
            <button onClick={() => setShowAddRow(false)} className="text-gray-500 hover:text-white text-sm px-3 py-2 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rates table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
          <p className="text-gray-500 text-sm">No rates yet.</p>
          <p className="text-gray-600 text-xs mt-1">Download the template, fill your costs, and upload.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {/* Group by category */}
          {Array.from(new Set(filtered.map(r => r.category))).map(cat => (
            <div key={cat}>
              <div className="px-4 py-2 bg-gray-800/60 border-b border-gray-800">
                <p className="text-amber-400 text-xs font-bold uppercase tracking-wide">{cat}</p>
              </div>
              {filtered.filter(r => r.category === cat).map((rate, i) => (
                <div key={rate.id || i} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/60 hover:bg-gray-800/30 group text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{rate.item_name}</p>
                    {rate.specification && <p className="text-gray-500 text-xs mt-0.5">{rate.specification}</p>}
                  </div>
                  <span className="text-gray-600 text-xs w-32 flex-shrink-0">{rate.unit}</span>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-amber-400 text-xs font-medium">₹{rate.our_cost.toLocaleString('en-IN')}</p>
                      <p className="text-gray-600 text-xs">cost</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-sm font-semibold">₹{rate.our_rate.toLocaleString('en-IN')}</p>
                      <p className="text-gray-600 text-xs">rate</p>
                    </div>
                    <div className="text-right w-12">
                      <p className={`text-xs font-semibold ${margin(rate) > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                        {margin(rate)}%
                      </p>
                      <p className="text-gray-600 text-xs">margin</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {saved === rate.id && <Check size={13} className="text-green-400" />}
                    <button onClick={() => rate.id && deleteRate(rate.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
