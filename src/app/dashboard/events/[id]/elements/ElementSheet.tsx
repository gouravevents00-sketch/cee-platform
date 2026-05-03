'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Lock, Upload } from 'lucide-react'

interface Element {
  id: string
  name: string
  specs?: string
  quantity: number
  size?: string
  material?: string
  vendor_id?: string
  vendor_rate?: number
  client_rate?: number
  margin?: number
  status: 'pending' | 'approved' | 'additional' | 'cancelled'
  poc_owner?: string
  notes?: string
  vendors?: { name: string }
}

interface TeamMember {
  id: string
  role_in_event: string
  department: string
  is_freelancer: boolean
  freelancer_name?: string
  member?: { id: string; name: string }
}

interface Props {
  eventId: string
  elements: Element[]
  vendors: { id: string; name: string; category?: string }[]
  teamMembers: TeamMember[]
  userRole: string
  userId: string
  showCosts: boolean
  isDirector: boolean
}

const STATUS_COLORS = {
  pending: 'bg-gray-800 text-gray-400',
  approved: 'bg-green-900/50 text-green-400',
  additional: 'bg-amber-900/50 text-amber-400',
  cancelled: 'bg-red-900/50 text-red-400',
}

const EMPTY_ROW = {
  name: '', specs: '', quantity: '1', size: '', material: '',
  vendor_id: '', vendor_rate: '', client_rate: '', poc_owner: '', notes: '',
}

export default function ElementSheet({ eventId, elements, vendors, teamMembers, userRole, userId, showCosts, isDirector }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_ROW)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg(null)

    const text = await file.text()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) { setImporting(false); setImportMsg('CSV too short — needs header + at least 1 row'); return }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',')
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim().replace(/^"|"$/g, '') })
      return obj
    }).filter(r => r.name || r.element_name || r['element name'])

    // Normalize column names
    const normalized = rows.map(r => ({
      name: r.name || r.element_name || r['element name'] || r.item || '',
      specs: r.specs || r.specification || r.description || '',
      quantity: r.quantity || r.qty || r.count || '1',
      size: r.size || r.dimensions || '',
      material: r.material || '',
      vendor_rate: r.vendor_rate || r.vendor_cost || r.rate || '',
      client_rate: r.client_rate || r.client_price || r.price || '',
      poc_owner: r.poc_owner || r.owner || r.poc || '',
      notes: r.notes || r.note || r.remarks || '',
    }))

    const res = await fetch(`/api/events/${eventId}/elements/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: normalized }),
    })
    const data = await res.json()
    if (data.ok) {
      setImportMsg(`✓ ${data.count} elements imported`)
      router.refresh()
    } else {
      setImportMsg(`Error: ${data.error}`)
    }
    setImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    await supabase.from('elements').insert({
      event_id: eventId,
      name: form.name,
      specs: form.specs || null,
      quantity: parseInt(form.quantity) || 1,
      size: form.size || null,
      material: form.material || null,
      vendor_id: form.vendor_id || null,
      vendor_rate: form.vendor_rate ? parseFloat(form.vendor_rate) : null,
      client_rate: form.client_rate ? parseFloat(form.client_rate) : null,
      poc_owner: form.poc_owner || null,
      notes: form.notes || null,
      status: 'pending',
    })

    setForm(EMPTY_ROW)
    setShowForm(false)
    router.refresh()
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this element?')) return
    setDeleting(id)
    await supabase.from('elements').delete().eq('id', id)
    router.refresh()
    setDeleting(null)
  }

  async function updateStatus(id: string, status: Element['status']) {
    await supabase.from('elements').update({ status }).eq('id', id)
    router.refresh()
  }

  async function updateAssignee(id: string, poc_owner: string) {
    await supabase.from('elements').update({ poc_owner: poc_owner || null }).eq('id', id)
    router.refresh()
  }

  const teamOptions = teamMembers.map(m => ({
    value: m.is_freelancer ? (m.freelancer_name || '') : (m.member?.name || ''),
    label: m.is_freelancer ? `${m.freelancer_name} (freelancer)` : (m.member?.name || ''),
  })).filter(o => o.value)

  const totalClientValue = showCosts
    ? elements.filter(e => e.status !== 'cancelled').reduce((sum, e) => sum + ((e.client_rate || 0) * e.quantity), 0)
    : 0
  const totalVendorCost = showCosts
    ? elements.filter(e => e.status !== 'cancelled').reduce((sum, e) => sum + ((e.vendor_rate || 0) * e.quantity), 0)
    : 0
  const totalMargin = totalClientValue - totalVendorCost

  const inputClass = "bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 w-full placeholder-gray-600"

  return (
    <div>
      {/* Summary Row (directors/accounts only) */}
      {showCosts && elements.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">Client Value</p>
            <p className="text-white font-bold text-lg">₹{totalClientValue.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">Vendor Cost</p>
            <p className="text-white font-bold text-lg">₹{totalVendorCost.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-gray-900 border border-green-900/40 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">Margin</p>
            <p className="text-green-400 font-bold text-lg">₹{totalMargin.toLocaleString('en-IN')}</p>
          </div>
        </div>
      )}

      {/* Add + Import Buttons */}
      {isDirector && (
        <div className="flex items-center gap-2 justify-end mb-4 flex-wrap">
          {importMsg && (
            <span className={`text-xs px-3 py-1.5 rounded-xl ${importMsg.startsWith('✓') ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
              {importMsg}
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            <Upload size={14} /> {importing ? 'Importing...' : 'Import CSV'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            <Plus size={16} /> Add Element
          </button>
        </div>
      )}

      {/* Add Form */}
      {showForm && isDirector && (
        <form onSubmit={handleAdd} className="bg-gray-900 border border-amber-700/40 rounded-2xl p-5 mb-5">
          <h3 className="text-white font-semibold mb-4">New Element</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Element Name *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required className={inputClass} placeholder="e.g. Stage Backdrop, Entry Gate" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Specs</label>
              <input type="text" value={form.specs} onChange={e => set('specs', e.target.value)} className={inputClass} placeholder="Material, finish, etc." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Size</label>
              <input type="text" value={form.size} onChange={e => set('size', e.target.value)} className={inputClass} placeholder="e.g. 20x10 ft" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Quantity</label>
              <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} min="1" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Material</label>
              <input type="text" value={form.material} onChange={e => set('material', e.target.value)} className={inputClass} placeholder="e.g. Star Flex, Sunboard" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Vendor</label>
              <select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)} className={inputClass}>
                <option value="">Select vendor...</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Assigned To</label>
              {teamOptions.length > 0 ? (
                <select value={form.poc_owner} onChange={e => set('poc_owner', e.target.value)} className={inputClass}>
                  <option value="">Unassigned</option>
                  {teamOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input type="text" value={form.poc_owner} onChange={e => set('poc_owner', e.target.value)} className={inputClass} placeholder="Who handles this?" />
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Vendor Rate (₹)</label>
              <input type="number" value={form.vendor_rate} onChange={e => set('vendor_rate', e.target.value)} className={inputClass} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Client Rate (₹)</label>
              <input type="number" value={form.client_rate} onChange={e => set('client_rate', e.target.value)} className={inputClass} placeholder="0" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} className={inputClass} placeholder="Any special notes..." />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-800 text-gray-400 rounded-xl py-2.5 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-amber-500 text-black font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50">
              {loading ? 'Adding...' : 'Add Element'}
            </button>
          </div>
        </form>
      )}

      {/* Elements Table */}
      {elements.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
          <p className="text-gray-500">No elements added yet</p>
          {isDirector && (
            <button onClick={() => setShowForm(true)} className="text-amber-500 text-sm mt-2 hover:text-amber-400">
              + Add first element
            </button>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className={`grid gap-3 px-4 py-3 border-b border-gray-800 bg-gray-800/50 text-xs text-gray-500 font-medium uppercase tracking-wider ${showCosts ? 'grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto]' : 'grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]'}`}>
            <span>Element</span>
            <span>Size</span>
            <span>Qty</span>
            {showCosts && <span>Vendor Rate</span>}
            {showCosts && <span>Client Rate</span>}
            {showCosts && <span>Margin</span>}
            {!showCosts && <span>Material</span>}
            {!showCosts && <span>Vendor</span>}
            <span>Status</span>
          </div>

          {/* Rows */}
          {elements.map(el => (
            <div
              key={el.id}
              className={`grid gap-3 px-4 py-3.5 border-b border-gray-800 last:border-0 items-center text-sm hover:bg-gray-800/30 transition-colors ${showCosts ? 'grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto]' : 'grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]'} ${el.status === 'cancelled' ? 'opacity-40' : ''}`}
            >
              <div>
                <p className="text-white font-medium">{el.name}</p>
                {el.specs && <p className="text-gray-500 text-xs mt-0.5">{el.specs}</p>}
                {isDirector && teamOptions.length > 0 ? (
                  <select
                    value={el.poc_owner || ''}
                    onChange={e => updateAssignee(el.id, e.target.value)}
                    className="mt-0.5 bg-transparent text-xs text-gray-500 border-0 outline-none cursor-pointer hover:text-amber-400 transition-colors w-full max-w-[160px]"
                  >
                    <option value="">Unassigned</option>
                    {teamOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  el.poc_owner && <p className="text-gray-600 text-xs">{el.poc_owner}</p>
                )}
                {el.notes && <p className="text-gray-600 text-xs italic">{el.notes}</p>}
              </div>
              <span className="text-gray-400 text-xs">{el.size || '—'}</span>
              <span className="text-gray-300">{el.quantity}</span>

              {showCosts ? (
                <>
                  <span className="text-gray-400 text-xs">
                    {el.vendor_rate ? `₹${el.vendor_rate.toLocaleString('en-IN')}` : '—'}
                  </span>
                  <span className="text-gray-300 text-xs">
                    {el.client_rate ? `₹${el.client_rate.toLocaleString('en-IN')}` : '—'}
                  </span>
                  <span className={`text-xs font-medium ${el.margin && el.margin > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {el.margin != null ? `₹${el.margin.toLocaleString('en-IN')}` : '—'}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-gray-400 text-xs">{el.material || '—'}</span>
                  <span className="text-gray-400 text-xs">{el.vendors?.name || '—'}</span>
                </>
              )}

              <div className="flex items-center gap-2">
                {isDirector ? (
                  <select
                    value={el.status}
                    onChange={e => updateStatus(el.id, e.target.value as Element['status'])}
                    className="bg-transparent text-xs border-0 outline-none cursor-pointer"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="additional">Additional</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                ) : (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[el.status]}`}>
                    {el.status}
                  </span>
                )}
                {isDirector && (
                  <button
                    onClick={() => handleDelete(el.id)}
                    disabled={deleting === el.id}
                    className="text-gray-700 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Footer totals (costs only) */}
          {showCosts && (
            <div className={`grid gap-3 px-4 py-3 bg-gray-800/30 text-sm font-semibold grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto]`}>
              <span className="text-gray-400">Total</span>
              <span />
              <span className="text-gray-300">{elements.filter(e => e.status !== 'cancelled').reduce((s, e) => s + e.quantity, 0)}</span>
              <span className="text-gray-400">₹{totalVendorCost.toLocaleString('en-IN')}</span>
              <span className="text-white">₹{totalClientValue.toLocaleString('en-IN')}</span>
              <span className="text-green-400">₹{totalMargin.toLocaleString('en-IN')}</span>
              <span />
            </div>
          )}
        </div>
      )}

      {/* Cost hidden notice for non-financial roles */}
      {!showCosts && (
        <div className="flex items-center gap-2 mt-4 text-gray-600 text-xs">
          <Lock size={12} /> Financial details are restricted to Directors and Accounts
        </div>
      )}
    </div>
  )
}
