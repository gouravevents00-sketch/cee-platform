'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Printer, Save, Send, Download, Upload, ListPlus } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────
type RowType = 'item' | 'section'

interface QuoteRow {
  _type: RowType
  // section fields
  label?: string
  // item fields
  description?: string
  specs?: string
  dims?: string
  days?: number
  qty?: number
  rate?: number
}

interface Props {
  eventId: string
  eventName: string
  clientName?: string
  clientContact?: string
  clientPhone?: string
  clientEmail?: string
  existingQuotation?: any
  eventElements: any[]
}

type GSTMode = 'none' | 'exclusive' | 'inclusive'
type Company = 'cee' | 'cex'

const COMPANIES = {
  cee: {
    name: 'CREATIVE ERA EVENTS',
    tagline: 'Creating Experiences That Last Forever',
    contact: 'Indore, Madhya Pradesh · +91 86023 71023 · creativeeraevents@gmail.com',
    prefix: 'CEE',
    footer: 'Creative Era Events · Indore, MP · creativeeraevents@gmail.com',
  },
  cex: {
    name: 'CREATIVE ERA EXPERIENCES',
    tagline: 'Technology Meets Emotion',
    contact: 'Indore, Madhya Pradesh · +91 86023 71023 · info@cex.creativeera.in',
    prefix: 'CEX',
    footer: 'Creative Era Experiences · Indore, MP · info@cex.creativeera.in',
  },
}

const EMPTY_ITEM: QuoteRow = { _type: 'item', description: '', specs: '', dims: '', days: 1, qty: 1, rate: 0 }

function rowAmount(r: QuoteRow) {
  if (r._type !== 'item') return 0
  return (r.days || 1) * (r.qty || 1) * (r.rate || 0)
}

function fmt(n: number) { return Math.round(n).toLocaleString('en-IN') }

// Number to words (Indian)
function numToWords(n: number): string {
  if (n <= 0) return ''
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  function b100(n: number): string { return n < 20 ? ones[n] : tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '') }
  function b1000(n: number): string { return n < 100 ? b100(n) : ones[Math.floor(n/100)]+' Hundred'+(n%100?' '+b100(n%100):'') }
  let r = ''
  if (n >= 10000000) { r += b1000(Math.floor(n/10000000))+' Crore '; n %= 10000000 }
  if (n >= 100000)   { r += b1000(Math.floor(n/100000))+' Lakh '; n %= 100000 }
  if (n >= 1000)     { r += b1000(Math.floor(n/1000))+' Thousand '; n %= 1000 }
  if (n > 0)         { r += b1000(n) }
  return r.trim()
}

export default function QuotationBuilder({
  eventId, eventName, clientName, clientContact, clientPhone, clientEmail,
  existingQuotation, eventElements
}: Props) {
  const existing = existingQuotation

  // Migrate old items format (no _type) to new rows format
  function migrateItems(items: any[]): QuoteRow[] {
    if (!items?.length) return [{ ...EMPTY_ITEM }]
    return items.map((it: any) => it._type ? it : {
      _type: 'item' as RowType,
      description: it.description || '',
      specs: it.specs || '',
      dims: it.dims || '',
      days: it.days || 1,
      qty: it.qty || it.quantity || 1,
      rate: it.rate || 0,
    })
  }

  const [rows, setRows] = useState<QuoteRow[]>(migrateItems(existing?.items))
  const [gstMode, setGstMode] = useState<GSTMode>(existing?.gst_mode || (existing?.gst_percent > 0 ? 'exclusive' : 'none'))
  const [discountPct, setDiscountPct] = useState<number>(existing?.discount_pct || 0)
  const [showDiscount, setShowDiscount] = useState(false)
  const [validity, setValidity] = useState(existing?.validity_days ?? 7)
  const [notes, setNotes] = useState(existing?.notes ?? '1. 50% advance at booking. Balance before event day.\n2. Cancellation within 7 days — 50% cancellation charges.\n3. Additional items billed separately.\n4. GST as applicable. All disputes: Indore jurisdiction.')
  const [quoteId, setQuoteId] = useState(existing?.id ?? null)
  const [quoteNumber, setQuoteNumber] = useState(existing?.quote_number ?? '')
  const [status, setStatus] = useState(existing?.status ?? 'draft')
  const [saving, setSaving] = useState(false)
  const [company, setCompany] = useState<Company>('cee')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const co = COMPANIES[company]
  const qNum = quoteNumber || `${co.prefix}/Q/${eventId.slice(0, 6).toUpperCase()}`
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const validUntil = new Date(Date.now() + validity * 86400000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  // ── Calculations ────────────────────────────────────────────────
  const subtotal = rows.reduce((s, r) => s + rowAmount(r), 0)
  const discountAmt = showDiscount ? subtotal * discountPct / 100 : 0
  const afterDiscount = subtotal - discountAmt
  const gstAmt = gstMode === 'exclusive' ? afterDiscount * 0.18
    : gstMode === 'inclusive' ? afterDiscount * 18 / 118
    : 0
  const grandTotal = gstMode === 'exclusive' ? afterDiscount + gstAmt : afterDiscount

  // ── Row ops ─────────────────────────────────────────────────────
  function updateRow(i: number, patch: Partial<QuoteRow>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }
  function addItem() { setRows(prev => [...prev, { ...EMPTY_ITEM }]) }
  function addSection() { setRows(prev => [...prev, { _type: 'section', label: '' }]) }
  function removeRow(i: number) { setRows(prev => prev.filter((_, idx) => idx !== i)) }

  function importFromElements() {
    if (!eventElements.length) return
    const newRows: QuoteRow[] = [
      { _type: 'section', label: eventName.toUpperCase() },
      ...eventElements.map(el => ({
        _type: 'item' as RowType,
        description: el.name || '',
        specs: [el.specs, el.material].filter(Boolean).join(' · '),
        dims: el.size || '',
        days: 1,
        qty: el.quantity || 1,
        rate: el.client_rate || 0,
      }))
    ]
    setRows(prev => [...prev, ...newRows])
  }

  // ── Save ────────────────────────────────────────────────────────
  async function save(newStatus?: string) {
    setSaving(true)
    const effectiveStatus = newStatus || status
    const payload = {
      event_id: eventId,
      items: rows,
      subtotal,
      gst_mode: gstMode,
      gst_percent: gstMode !== 'none' ? 18 : 0,
      gst_amount: gstAmt,
      discount_pct: showDiscount ? discountPct : 0,
      total: grandTotal,
      validity_days: validity,
      notes: notes || null,
      status: effectiveStatus,
    }
    if (quoteId) {
      await supabase.from('quotations').update(payload).eq('id', quoteId)
    } else {
      const { data } = await supabase.from('quotations').insert(payload).select().single()
      if (data) {
        setQuoteId(data.id)
        setQuoteNumber(data.quote_number || `${co.prefix}/Q/${data.id.slice(0, 6).toUpperCase()}`)
      }
    }
    if (newStatus) setStatus(newStatus)
    setSaving(false)
    router.refresh()
  }

  // ── JSON Export (HTML-tool compatible) ──────────────────────────
  function exportJSON() {
    const data = {
      meta: {
        company,
        quotNo: qNum,
        quotDate: today,
        quotValid: validUntil,
        version: 'v1',
        companyName: co.name,
        tagline: co.tagline,
        contact: co.contact,
      },
      client: {
        company: clientName || '—',
        name: clientContact || '—',
        phone: clientPhone || '—',
        email: clientEmail || '—',
        gst: '—',
      },
      event: { name: eventName, type: '—', dates: today, venue: '—', pax: '—' },
      notes,
      terms: notes,
      gstMode,
      showDiscount,
      discountPct,
      rows: rows.map(r =>
        r._type === 'section'
          ? { _section: true, label: r.label || '' }
          : { element: r.description || '', spec: r.specs || '', dims: r.dims || '', days: r.days ?? 1, qty: r.qty ?? 1, rate: r.rate ?? 0 }
      ),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `CEE_Quot_${(clientName || 'Client').replace(/[^a-z0-9]/gi, '_')}_${qNum.replace(/\//g, '-')}.json`
    a.click()
  }

  // ── JSON Import (HTML-tool compatible) ──────────────────────────
  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target?.result as string)
        if (d.meta?.company) setCompany(d.meta.company as Company)
        if (d.gstMode) setGstMode(d.gstMode as GSTMode)
        if (d.showDiscount !== undefined) setShowDiscount(d.showDiscount)
        if (d.discountPct !== undefined) setDiscountPct(Number(d.discountPct))
        if (d.notes) setNotes(d.notes)
        const imported: QuoteRow[] = (d.rows || []).map((r: any) =>
          r._section
            ? { _type: 'section' as RowType, label: r.label || '' }
            : { _type: 'item' as RowType, description: r.element || '', specs: r.spec || '', dims: r.dims || '', days: Number(r.days) || 1, qty: Number(r.qty) || 1, rate: Number(r.rate) || 0 }
        )
        setRows(imported.length ? imported : [{ ...EMPTY_ITEM }])
      } catch { alert('Invalid JSON file') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const inputCls = "bg-transparent text-gray-900 text-sm focus:outline-none w-full placeholder-gray-400"

  return (
    <div className="space-y-4">
      {/* ── Action Bar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap print:hidden">
        {/* Company switch */}
        <select value={company} onChange={e => setCompany(e.target.value as Company)}
          className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-xl px-3 py-2 focus:outline-none">
          <option value="cee">Creative Era Events</option>
          <option value="cex">Creative Era Experiences</option>
        </select>

        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          status === 'draft' ? 'bg-gray-800 text-gray-400' :
          status === 'sent' ? 'bg-blue-900/50 text-blue-400' :
          status === 'accepted' ? 'bg-green-900/50 text-green-400' :
          'bg-red-900/50 text-red-400'
        }`}>{status.toUpperCase()}</span>

        <button onClick={() => save()} disabled={saving}
          className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
          <Save size={13} /> {saving ? 'Saving...' : 'Save'}
        </button>
        {status === 'draft' && (
          <button onClick={() => save('sent')} disabled={saving}
            className="flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-blue-400 text-sm px-4 py-2 rounded-xl transition-colors">
            <Send size={13} /> Mark Sent
          </button>
        )}
        {status === 'sent' && (
          <>
            <button onClick={() => save('accepted')} disabled={saving}
              className="bg-green-950 hover:bg-green-900 text-green-400 text-sm px-4 py-2 rounded-xl transition-colors">Accepted</button>
            <button onClick={() => save('rejected')} disabled={saving}
              className="bg-red-950 hover:bg-red-900 text-red-400 text-sm px-4 py-2 rounded-xl transition-colors">Rejected</button>
          </>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {eventElements.length > 0 && (
            <button onClick={importFromElements}
              className="flex items-center gap-1.5 bg-amber-950 hover:bg-amber-900 text-amber-400 text-sm px-4 py-2 rounded-xl transition-colors">
              <ListPlus size={13} /> Import Elements
            </button>
          )}
          <button onClick={exportJSON}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-3 py-2 rounded-xl transition-colors">
            <Download size={13} /> JSON
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-3 py-2 rounded-xl transition-colors">
            <Upload size={13} /> Load
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm px-4 py-2 rounded-xl transition-colors">
            <Printer size={13} /> Print / PDF
          </button>
        </div>
      </div>

      {/* ── Quotation Document ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl text-gray-900 print:shadow-none print:rounded-none" id="quotation-doc">

        {/* Letterhead */}
        <div className="px-8 py-6 flex items-start justify-between" style={{ background: '#1a1a2e' }}>
          <div>
            <p className="font-black text-lg tracking-widest uppercase" style={{ color: '#c9a84c' }}>{co.name}</p>
            <p className="text-xs mt-1" style={{ color: '#aab' }}>{co.tagline}</p>
            <p className="text-xs mt-2" style={{ color: '#ccc' }}>{co.contact}</p>
          </div>
          <div className="text-right">
            <p className="font-black text-xl tracking-widest" style={{ color: '#c9a84c' }}>QUOTATION</p>
            <div className="text-xs mt-2 space-y-0.5" style={{ color: '#ccc' }}>
              <p>No: <span className="text-white font-semibold">{qNum}</span></p>
              <p>Date: {today}</p>
              <p>Valid till: {validUntil}</p>
            </div>
          </div>
        </div>

        {/* Client + Event Details */}
        <div className="grid grid-cols-2 border-b-2 border-gray-900" style={{ borderBottom: '2px solid #1a1a2e' }}>
          <div className="px-8 py-4 border-r border-gray-200">
            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#c9a84c' }}>Client Details</p>
            <div className="space-y-1 text-sm">
              <div className="flex gap-3"><span className="text-gray-400 w-28 flex-shrink-0 text-xs">Client / Company</span><span className="font-semibold text-gray-900">{clientName || '—'}</span></div>
              <div className="flex gap-3"><span className="text-gray-400 w-28 flex-shrink-0 text-xs">Contact Person</span><span className="text-gray-700">{clientContact || '—'}</span></div>
              <div className="flex gap-3"><span className="text-gray-400 w-28 flex-shrink-0 text-xs">Phone</span><span className="text-gray-700">{clientPhone || '—'}</span></div>
              <div className="flex gap-3"><span className="text-gray-400 w-28 flex-shrink-0 text-xs">Email</span><span className="text-gray-700">{clientEmail || '—'}</span></div>
            </div>
          </div>
          <div className="px-8 py-4">
            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#c9a84c' }}>Event Details</p>
            <div className="space-y-1 text-sm">
              <div className="flex gap-3"><span className="text-gray-400 w-28 flex-shrink-0 text-xs">Event Name</span><span className="font-semibold text-gray-900">{eventName}</span></div>
            </div>
          </div>
        </div>

        {/* Scope Header */}
        <div className="px-8 py-2 text-xs font-black uppercase tracking-widest" style={{ background: '#1a1a2e', color: '#c9a84c' }}>
          Scope of Work &amp; Pricing
        </div>

        {/* Items Table */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: '#2d3561' }}>
              <th className="text-left px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-8 pl-8">#</th>
              <th className="text-left px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide">Element / Item</th>
              <th className="text-left px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide">Specification</th>
              <th className="text-left px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-24">Dimensions</th>
              <th className="text-center px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-14">Days</th>
              <th className="text-center px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-14">Qty</th>
              <th className="text-right px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-24">Rate (₹)</th>
              <th className="text-right px-3 py-2.5 pr-8 text-white text-xs font-bold uppercase tracking-wide w-28">Amount (₹)</th>
              <th className="w-6 print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const itemNum = rows.slice(0, i + 1).filter(r => r._type === 'item').length
              if (row._type === 'section') {
                return (
                  <tr key={i} style={{ background: '#1a1a2e' }}>
                    <td colSpan={8} className="px-8 py-2">
                      <input
                        value={row.label || ''}
                        onChange={e => updateRow(i, { label: e.target.value })}
                        placeholder="— Section Header —"
                        className="bg-transparent text-xs font-black uppercase tracking-widest w-full focus:outline-none print:pointer-events-none"
                        style={{ color: '#c9a84c' }}
                      />
                    </td>
                    <td className="print:hidden" style={{ background: '#1a1a2e' }}>
                      <button onClick={() => removeRow(i)} className="text-gray-600 hover:text-red-400 transition-colors px-1">✕</button>
                    </td>
                  </tr>
                )
              }
              const amt = rowAmount(row)
              return (
                <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50'} hover:bg-amber-50 transition-colors group`}>
                  <td className="px-3 py-2 text-gray-400 text-xs text-center pl-8">{itemNum}</td>
                  <td className="px-3 py-2">
                    <input value={row.description || ''} onChange={e => updateRow(i, { description: e.target.value })}
                      placeholder="Element name..." className={inputCls} />
                  </td>
                  <td className="px-3 py-2">
                    <input value={row.specs || ''} onChange={e => updateRow(i, { specs: e.target.value })}
                      placeholder="Spec / material..." className={inputCls} />
                  </td>
                  <td className="px-3 py-2">
                    <input value={row.dims || ''} onChange={e => updateRow(i, { dims: e.target.value })}
                      placeholder="10×8 ft" className={inputCls} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={row.days ?? 1} min="0"
                      onChange={e => updateRow(i, { days: Number(e.target.value) })}
                      className="text-center text-sm focus:outline-none w-12 bg-transparent text-gray-900 print:pointer-events-none" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={row.qty ?? 1} min="0"
                      onChange={e => updateRow(i, { qty: Number(e.target.value) })}
                      className="text-center text-sm focus:outline-none w-12 bg-transparent text-gray-900 print:pointer-events-none" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={row.rate ?? 0} min="0"
                      onChange={e => updateRow(i, { rate: Number(e.target.value) })}
                      className="text-right text-sm focus:outline-none w-20 bg-transparent text-gray-900 print:pointer-events-none" />
                  </td>
                  <td className="px-3 py-2 pr-8 text-right font-semibold text-gray-700">
                    {amt ? `₹ ${fmt(amt)}` : '—'}
                  </td>
                  <td className="print:hidden">
                    <button onClick={() => removeRow(i)}
                      className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all px-1">✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Add Row Bar */}
        <div className="flex gap-3 px-8 py-2.5 bg-gray-50 border-t border-gray-200 print:hidden">
          <button onClick={addItem}
            className="flex items-center gap-1.5 text-xs font-bold border border-dashed px-4 py-1.5 rounded transition-colors"
            style={{ borderColor: '#c9a84c', color: '#c9a84c' }}>
            <Plus size={11} /> Add Row
          </button>
          <button onClick={addSection}
            className="flex items-center gap-1.5 text-xs font-bold border border-dashed border-gray-400 text-gray-500 px-4 py-1.5 rounded hover:border-gray-600 transition-colors">
            <ListPlus size={11} /> Section Header
          </button>
        </div>

        {/* GST Options (screen) */}
        <div className="flex items-center justify-end gap-4 px-8 py-2 text-xs text-gray-600 print:hidden">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showDiscount} onChange={e => setShowDiscount(e.target.checked)} />
            Show Discount
          </label>
          <label className="flex items-center gap-1.5">
            GST:
            <select value={gstMode} onChange={e => setGstMode(e.target.value as GSTMode)}
              className="border border-gray-300 rounded px-2 py-1 text-xs ml-1 focus:outline-none">
              <option value="none">No GST</option>
              <option value="exclusive">+18% GST (exclusive)</option>
              <option value="inclusive">18% GST (inclusive)</option>
            </select>
          </label>
        </div>

        {/* Totals */}
        <div className="flex justify-end px-8 pb-6 pt-2 border-t-2 border-gray-900" style={{ borderTopColor: '#1a1a2e' }}>
          <div className="w-72 space-y-1.5 text-sm">
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold">₹ {fmt(subtotal)}</span>
            </div>
            {showDiscount && (
              <div className="flex items-center justify-between py-1 border-b border-gray-200">
                <span className="text-red-600 flex items-center gap-2">
                  Discount
                  <input type="number" value={discountPct} min="0" max="100"
                    onChange={e => setDiscountPct(Number(e.target.value))}
                    className="w-14 border border-red-300 rounded px-1 py-0.5 text-xs text-center focus:outline-none" /> %
                </span>
                <span className="text-red-600 font-semibold">- ₹ {fmt(discountAmt)}</span>
              </div>
            )}
            {gstMode !== 'none' && (
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-600">GST 18% ({gstMode === 'exclusive' ? 'added' : 'included'})</span>
                <span className="font-semibold">₹ {fmt(gstAmt)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 px-3 rounded-lg mt-2" style={{ background: '#1a1a2e' }}>
              <span className="font-black uppercase tracking-wide text-xs" style={{ color: '#c9a84c' }}>Grand Total</span>
              <span className="font-black text-white text-base">₹ {fmt(grandTotal)}</span>
            </div>
            {grandTotal > 0 && (
              <p className="text-right text-gray-400 text-xs italic">
                Rupees {numToWords(Math.round(grandTotal))} Only
              </p>
            )}
          </div>
        </div>

        {/* Notes / T&C */}
        <div className="px-8 py-5 bg-gray-50 border-t border-gray-200">
          <p className="text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Notes / Terms &amp; Conditions</p>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
            placeholder="Payment terms, cancellation policy, GST notes..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 focus:outline-none focus:border-amber-400 resize-none print:border-0 print:p-0 print:bg-transparent" />
          <p className="text-gray-500 text-xs mt-2">Valid until: {validUntil}</p>
        </div>

        {/* Footer */}
        <div className="px-8 py-3 flex items-center justify-between border-t border-gray-200" style={{ background: '#1a1a2e' }}>
          <p className="text-xs" style={{ color: '#888' }}>{co.footer}</p>
          <p className="text-xs" style={{ color: '#888' }}>#{qNum}</p>
        </div>
      </div>
    </div>
  )
}
