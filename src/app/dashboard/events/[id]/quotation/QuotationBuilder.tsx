'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Printer, Save, Send, Download, Upload, ListPlus,
  Lock, Wand2, ChevronDown, ChevronUp, Eye, EyeOff, CheckCircle2,
} from 'lucide-react'

// ══════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════

type RowType = 'item' | 'section'
type GSTMode = 'none' | 'exclusive' | 'inclusive'
type Company = 'cee' | 'cex'
type PrintView = 'internal' | 'client'

interface QuoteRow {
  _type: RowType
  // section
  label?: string
  // item
  description?: string
  specs?: string
  dim_str?: string      // "20×10 ft", "15 rft", "8×4 ft", "Lumpsum"
  area_sqft?: number    // auto-computed
  days?: number
  qty?: number
  rate?: number         // client rate per unit
  vendor_rate?: number  // internal cost (hidden in client print)
  vendor_id?: string    // reference to vendors table
  is_lumpsum?: boolean
  lump_amount?: number  // fixed total amount if lumpsum
}

interface Milestone {
  label: string
  percent: number
  due_date: string
}

interface Compliance {
  gst_no: string
  pan: string
  msme: string
  bank_name: string
  account_no: string
  ifsc: string
  tds: string
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
  vendors: { id: string; name: string; category?: string }[]
  userRole: string
}

// ══════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════

const COMPANIES = {
  cee: {
    name: 'CREATIVE ERA EVENTS',
    tagline: 'Creating Experiences That Last Forever',
    contact: 'Indore, Madhya Pradesh · +91 86023 71023 · creativeeraevents@gmail.com',
    prefix: 'CEE',
    footer: 'Creative Era Events · creativeeraevents@gmail.com · Indore, MP',
    gst: '23XXXXX0000X1Z5',
    pan: 'XXXXX0000X',
    msme: 'UDYAM-MP-XX-XXXXXXX',
  },
  cex: {
    name: 'CREATIVE ERA EXPERIENCES',
    tagline: 'Technology Meets Emotion',
    contact: 'Indore, Madhya Pradesh · +91 86023 71023 · info@cex.creativeera.in',
    prefix: 'CEX',
    footer: 'Creative Era Experiences · info@cex.creativeera.in · Indore, MP',
    gst: '23XXXXX0000X1Z5',
    pan: 'XXXXX0000X',
    msme: 'UDYAM-MP-XX-XXXXXXX',
  },
}

const DEFAULT_COMPLIANCE: Compliance = {
  gst_no: '',
  pan: '',
  msme: '',
  bank_name: 'HDFC Bank',
  account_no: '',
  ifsc: '',
  tds: 'TDS @ 2% u/s 194C',
}

const DEFAULT_MILESTONES: Milestone[] = [
  { label: '50% Advance at booking', percent: 50, due_date: '' },
  { label: '25% Before event day', percent: 25, due_date: '' },
  { label: '25% Balance after event', percent: 25, due_date: '' },
]

const EMPTY_ITEM: QuoteRow = {
  _type: 'item', description: '', specs: '', dim_str: '', days: 1, qty: 1, rate: 0,
  vendor_rate: 0, vendor_id: '', is_lumpsum: false, lump_amount: 0,
}

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════

/** Parse dimension string → area in sq.ft.
 *  "20×10"  → 200   "32×12×4" → uses first two dims → 384
 *  "15 rft" → 15    "Lumpsum" → 0   "8x4 ft" → 32
 */
function parseDimStr(s: string): number {
  if (!s) return 0
  const lower = s.toLowerCase().trim()
  if (lower === 'lumpsum' || lower === 'ls') return 0
  // rft / running feet
  const rftMatch = lower.match(/^([\d.]+)\s*(?:rft|running|rft\.?)/)
  if (rftMatch) return parseFloat(rftMatch[1])
  // WxH or WxHxD — take first two numbers
  const dimMatch = lower.match(/([\d.]+)\s*[×x*]\s*([\d.]+)/)
  if (dimMatch) return parseFloat(dimMatch[1]) * parseFloat(dimMatch[2])
  // single number
  const num = parseFloat(lower)
  return isNaN(num) ? 0 : num
}

function rowAmount(r: QuoteRow): number {
  if (r._type !== 'item') return 0
  if (r.is_lumpsum) return r.lump_amount || 0
  const area = r.area_sqft || 0
  const multiplier = area > 0 ? area : 1
  return (r.days || 1) * (r.qty || 1) * multiplier * (r.rate || 0)
}

function rowVendorCost(r: QuoteRow): number {
  if (r._type !== 'item') return 0
  if (r.is_lumpsum) return 0
  const area = r.area_sqft || 0
  const multiplier = area > 0 ? area : 1
  return (r.days || 1) * (r.qty || 1) * multiplier * (r.vendor_rate || 0)
}

function rowMargin(r: QuoteRow): number {
  return rowAmount(r) - rowVendorCost(r)
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-IN')
}

function numToWords(n: number): string {
  if (n <= 0) return ''
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  function b100(x: number): string { return x < 20 ? ones[x] : tens[Math.floor(x/10)] + (x%10 ? ' '+ones[x%10] : '') }
  function b1000(x: number): string { return x < 100 ? b100(x) : ones[Math.floor(x/100)]+' Hundred'+(x%100?' '+b100(x%100):'') }
  let r = '', rem = n
  if (rem >= 10000000) { r += b1000(Math.floor(rem/10000000))+' Crore '; rem %= 10000000 }
  if (rem >= 100000)   { r += b1000(Math.floor(rem/100000))+' Lakh '; rem %= 100000 }
  if (rem >= 1000)     { r += b1000(Math.floor(rem/1000))+' Thousand '; rem %= 1000 }
  if (rem > 0)         { r += b1000(rem) }
  return r.trim()
}

// ══════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════

export default function QuotationBuilder({
  eventId, eventName, clientName, clientContact, clientPhone, clientEmail,
  existingQuotation, eventElements, vendors, userRole,
}: Props) {
  const isDirector = userRole === 'director'
  const canEdit = ['director', 'accounts', 'admin'].includes(userRole)
  const existing = existingQuotation
  const isLocked = !!existing?.locked_at

  // ── Migrate old items format ───────────────────────────────────
  function migrateItems(items: any[]): QuoteRow[] {
    if (!items?.length) return [{ ...EMPTY_ITEM }]
    return items.map((it: any): QuoteRow => {
      if (it._type === 'section') return { _type: 'section', label: it.label || '' }
      return {
        _type: 'item',
        description: it.description || '',
        specs: it.specs || '',
        dim_str: it.dim_str || it.dims || '',
        area_sqft: it.area_sqft || parseDimStr(it.dim_str || it.dims || ''),
        days: it.days || 1,
        qty: it.qty || it.quantity || 1,
        rate: it.rate || 0,
        vendor_rate: it.vendor_rate || 0,
        vendor_id: it.vendor_id || '',
        is_lumpsum: it.is_lumpsum || false,
        lump_amount: it.lump_amount || 0,
      }
    })
  }

  // ── State ──────────────────────────────────────────────────────
  const [rows, setRows] = useState<QuoteRow[]>(migrateItems(existing?.items))
  const [gstMode, setGstMode] = useState<GSTMode>(
    existing?.gst_mode || (existing?.gst_percent > 0 ? 'exclusive' : 'none')
  )
  const [discountPct, setDiscountPct] = useState<number>(existing?.discount_pct || 0)
  const [showDiscount, setShowDiscount] = useState(discountPct > 0)
  const [validity, setValidity] = useState(existing?.validity_days ?? 7)
  const [notes, setNotes] = useState(
    existing?.notes ?? '1. 50% advance at booking confirmation. Balance before event.\n2. Cancellation within 7 days — 50% charges apply.\n3. Additional items will be billed separately.\n4. GST as applicable. All disputes subject to Indore jurisdiction.'
  )
  const [quoteId, setQuoteId] = useState(existing?.id ?? null)
  const [quoteNumber, setQuoteNumber] = useState(existing?.quote_number ?? '')
  const [status, setStatus] = useState(existing?.status ?? 'draft')
  const [company, setCompany] = useState<Company>(existing?.company || 'cee')
  const [milestones, setMilestones] = useState<Milestone[]>(
    existing?.payment_milestones?.length ? existing.payment_milestones : DEFAULT_MILESTONES
  )
  const [compliance, setCompliance] = useState<Compliance>(
    existing?.compliance && Object.keys(existing.compliance).length
      ? existing.compliance
      : DEFAULT_COMPLIANCE
  )
  const [printView, setPrintView] = useState<PrintView>('internal')
  const [saving, setSaving] = useState(false)
  const [locking, setLocking] = useState(false)
  const [lockDone, setLockDone] = useState(isLocked)
  const [showMilestones, setShowMilestones] = useState(true)
  const [showCompliance, setShowCompliance] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [aiBrief, setAiBrief] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showVendorCol, setShowVendorCol] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const aiFileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const co = COMPANIES[company]
  const qNum = quoteNumber || `${co.prefix}/Q/${eventId.slice(0, 6).toUpperCase()}`
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const validUntil = new Date(Date.now() + validity * 86400000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const isClientPrint = printView === 'client'

  // ── Calculations ───────────────────────────────────────────────
  const subtotal = rows.reduce((s, r) => s + rowAmount(r), 0)
  const totalVendorCost = rows.reduce((s, r) => s + rowVendorCost(r), 0)
  const totalMargin = subtotal - totalVendorCost
  const discountAmt = showDiscount ? subtotal * discountPct / 100 : 0
  const afterDiscount = subtotal - discountAmt
  const gstAmt = gstMode === 'exclusive' ? afterDiscount * 0.18
    : gstMode === 'inclusive' ? afterDiscount * 18 / 118
    : 0
  const grandTotal = gstMode === 'exclusive' ? afterDiscount + gstAmt : afterDiscount

  // ── Row operations ─────────────────────────────────────────────
  const updateRow = useCallback((i: number, patch: Partial<QuoteRow>) => {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      const updated = { ...r, ...patch }
      // Auto-compute area when dim_str changes
      if (patch.dim_str !== undefined) {
        updated.area_sqft = parseDimStr(patch.dim_str || '')
      }
      return updated
    }))
  }, [])

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
        dim_str: el.size || '',
        area_sqft: parseDimStr(el.size || ''),
        days: 1,
        qty: el.quantity || 1,
        rate: el.client_rate || 0,
        vendor_rate: el.vendor_rate || 0,
        vendor_id: el.vendor_id || '',
        is_lumpsum: false,
        lump_amount: 0,
      }))
    ]
    setRows(prev => [...prev, ...newRows])
  }

  // ── Milestone operations ───────────────────────────────────────
  function updateMilestone(i: number, patch: Partial<Milestone>) {
    setMilestones(prev => prev.map((m, idx) => idx === i ? { ...m, ...patch } : m))
  }
  function addMilestone() {
    setMilestones(prev => [...prev, { label: 'Additional milestone', percent: 0, due_date: '' }])
  }
  function removeMilestone(i: number) {
    setMilestones(prev => prev.filter((_, idx) => idx !== i))
  }
  const milestonesTotal = milestones.reduce((s, m) => s + (m.percent || 0), 0)

  // ── Save ───────────────────────────────────────────────────────
  async function save(newStatus?: string) {
    if (!canEdit) return
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
      payment_milestones: milestones,
      compliance,
      company,
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

  // ── Lock ───────────────────────────────────────────────────────
  async function handleLock() {
    if (!isDirector || !quoteId) return
    if (!confirm('Lock this quotation? This will:\n• Generate element sheet with vendor assignments\n• Create payment milestones\n• Set event to Active\n• Notify team\n\nThis cannot be undone.')) return

    setLocking(true)
    await save() // save latest state first
    const res = await fetch(`/api/quotations/${quoteId}/lock`, { method: 'POST' })
    if (res.ok) {
      setLockDone(true)
      setStatus('accepted')
    } else {
      const err = await res.json()
      alert(err.error || 'Lock failed')
    }
    setLocking(false)
    router.refresh()
  }

  // ── AI Brief Parser ────────────────────────────────────────────
  async function handleParseBrief() {
    if (!aiBrief.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/parse-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: aiBrief, eventName }),
      })
      const data = await res.json()
      if (data.rows?.length) {
        const parsed: QuoteRow[] = data.rows.map((r: any): QuoteRow => {
          if (r._type === 'section') return { _type: 'section', label: r.label || '' }
          return {
            _type: 'item',
            description: r.description || '',
            specs: r.specs || '',
            dim_str: r.dim_str || '',
            area_sqft: parseDimStr(r.dim_str || ''),
            days: r.days || 1,
            qty: r.qty || 1,
            rate: r.rate || 0,
            vendor_rate: 0,
            vendor_id: '',
            is_lumpsum: false,
            lump_amount: 0,
          }
        })
        setRows(prev => [...prev, ...parsed])
        setShowAI(false)
        setAiBrief('')
      } else {
        alert(data.error || 'No rows could be extracted')
      }
    } catch {
      alert('AI parse failed')
    }
    setAiLoading(false)
  }

  // ── AI File Upload ─────────────────────────────────────────────
  async function handleAIFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAiLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('eventName', eventName)
      const res = await fetch('/api/ai/parse-brief', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.rows?.length) {
        const parsed: QuoteRow[] = data.rows.map((r: any): QuoteRow => {
          if (r._type === 'section') return { _type: 'section', label: r.label || '' }
          return {
            _type: 'item',
            description: r.description || '',
            specs: r.specs || '',
            dim_str: r.dim_str || '',
            area_sqft: parseDimStr(r.dim_str || ''),
            days: r.days || 1,
            qty: r.qty || 1,
            rate: r.rate || 0,
            vendor_rate: 0,
            vendor_id: '',
            is_lumpsum: false,
            lump_amount: 0,
          }
        })
        setRows(prev => [...prev, ...parsed])
        setShowAI(false)
      } else {
        alert(data.error || 'No rows could be extracted from file')
      }
    } catch {
      alert('File parse failed')
    }
    setAiLoading(false)
    // Reset file input so same file can be re-uploaded
    e.target.value = ''
  }

  // ── JSON Export ────────────────────────────────────────────────
  function exportJSON() {
    const data = {
      meta: { company, quotNo: qNum, quotDate: today, quotValid: validUntil,
        companyName: co.name, tagline: co.tagline, contact: co.contact },
      client: { company: clientName||'—', name: clientContact||'—', phone: clientPhone||'—', email: clientEmail||'—' },
      event: { name: eventName },
      gstMode, showDiscount, discountPct, notes,
      milestones, compliance,
      rows: rows.map(r =>
        r._type === 'section'
          ? { _section: true, label: r.label||'' }
          : { element: r.description||'', spec: r.specs||'', dim_str: r.dim_str||'', dims: r.dim_str||'',
              area_sqft: r.area_sqft||0, days: r.days??1, qty: r.qty??1, rate: r.rate??0,
              vendor_rate: r.vendor_rate??0, is_lumpsum: r.is_lumpsum||false, lump_amount: r.lump_amount||0 }
      ),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `CEE_Quot_${(clientName||'Client').replace(/[^a-z0-9]/gi,'_')}_${qNum.replace(/\//g,'-')}.json`
    a.click()
  }

  // ── JSON Import ────────────────────────────────────────────────
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
        if (d.milestones?.length) setMilestones(d.milestones)
        if (d.compliance) setCompliance({ ...DEFAULT_COMPLIANCE, ...d.compliance })
        const imported: QuoteRow[] = (d.rows || []).map((r: any): QuoteRow =>
          r._section
            ? { _type: 'section', label: r.label||'' }
            : { _type: 'item', description: r.element||r.description||'', specs: r.spec||r.specs||'',
                dim_str: r.dim_str||r.dims||'', area_sqft: r.area_sqft||parseDimStr(r.dim_str||r.dims||''),
                days: Number(r.days)||1, qty: Number(r.qty)||1, rate: Number(r.rate)||0,
                vendor_rate: Number(r.vendor_rate)||0, is_lumpsum: r.is_lumpsum||false,
                lump_amount: Number(r.lump_amount)||0, vendor_id: r.vendor_id||'' }
        )
        setRows(imported.length ? imported : [{ ...EMPTY_ITEM }])
      } catch { alert('Invalid JSON file') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Print ──────────────────────────────────────────────────────
  function handlePrint(view: PrintView) {
    setPrintView(view)
    // Wait for state update + re-render then print
    setTimeout(() => window.print(), 100)
  }

  // ══════════════════════════════════════════════════════════════
  // STYLES
  // ══════════════════════════════════════════════════════════════
  const inputCls = 'bg-transparent text-gray-900 text-sm focus:outline-none w-full placeholder-gray-400'
  const internalBg = '#1a1a2e'
  const gold = '#c9a84c'

  // Client print styles differ from internal
  const docBg = isClientPrint ? '#fef9f0' : '#ffffff'
  const tableHeaderBg = '#2d3561'
  const rowEvenBg = isClientPrint ? '#fef9f0' : '#ffffff'
  const rowOddBg = isClientPrint ? '#fdf3e0' : '#f9fafb'
  const borderColor = isClientPrint ? '#e8d5a3' : '#e5e7eb'

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">

      {/* ── TOP ACTION BAR ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap print:hidden">

        {/* Company switch */}
        <select value={company} onChange={e => setCompany(e.target.value as Company)}
          disabled={isLocked || !canEdit}
          className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-xl px-3 py-2 focus:outline-none disabled:opacity-50">
          <option value="cee">Creative Era Events</option>
          <option value="cex">Creative Era Experiences</option>
        </select>

        {/* Status badge */}
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          lockDone ? 'bg-green-900/50 text-green-400' :
          status === 'draft' ? 'bg-gray-800 text-gray-400' :
          status === 'sent' ? 'bg-blue-900/50 text-blue-400' :
          status === 'accepted' ? 'bg-green-900/50 text-green-400' :
          'bg-red-900/50 text-red-400'
        }`}>
          {lockDone ? '🔒 LOCKED' : status.toUpperCase()}
        </span>

        {/* Save */}
        {canEdit && !lockDone && (
          <button onClick={() => save()} disabled={saving}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
            <Save size={13} /> {saving ? 'Saving...' : 'Save'}
          </button>
        )}

        {/* Status transitions */}
        {canEdit && !lockDone && status === 'draft' && (
          <button onClick={() => save('sent')} disabled={saving}
            className="flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-blue-400 text-sm px-4 py-2 rounded-xl transition-colors">
            <Send size={13} /> Mark Sent
          </button>
        )}
        {canEdit && !lockDone && status === 'sent' && (
          <>
            <button onClick={() => save('accepted')} disabled={saving}
              className="bg-green-950 hover:bg-green-900 text-green-400 text-sm px-4 py-2 rounded-xl transition-colors">Accepted</button>
            <button onClick={() => save('rejected')} disabled={saving}
              className="bg-red-950 hover:bg-red-900 text-red-400 text-sm px-4 py-2 rounded-xl transition-colors">Rejected</button>
          </>
        )}

        {/* LOCK button — director only */}
        {isDirector && !lockDone && quoteId && (
          <button onClick={handleLock} disabled={locking}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm px-5 py-2 rounded-xl transition-colors disabled:opacity-50">
            <Lock size={13} /> {locking ? 'Locking...' : 'LOCK & ACTIVATE'}
          </button>
        )}
        {lockDone && (
          <span className="flex items-center gap-1.5 text-green-400 text-sm">
            <CheckCircle2 size={14} /> Quotation locked — elements &amp; tasks generated
          </span>
        )}

        {/* Right side tools */}
        <div className="flex items-center gap-2 ml-auto">
          {/* AI Brief */}
          {canEdit && !lockDone && (
            <button onClick={() => setShowAI(v => !v)}
              className="flex items-center gap-1.5 bg-purple-950 hover:bg-purple-900 text-purple-400 text-sm px-4 py-2 rounded-xl transition-colors">
              <Wand2 size={13} /> AI Parse
            </button>
          )}

          {/* Import elements */}
          {canEdit && !lockDone && eventElements.length > 0 && (
            <button onClick={importFromElements}
              className="flex items-center gap-1.5 bg-amber-950 hover:bg-amber-900 text-amber-400 text-sm px-4 py-2 rounded-xl transition-colors">
              <ListPlus size={13} /> Import
            </button>
          )}

          {/* Vendor col toggle — internal only */}
          {isDirector && (
            <button onClick={() => setShowVendorCol(v => !v)}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm px-3 py-2 rounded-xl transition-colors"
              title="Toggle vendor column">
              {showVendorCol ? <EyeOff size={13} /> : <Eye size={13} />} Vendor
            </button>
          )}

          <button onClick={exportJSON}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-3 py-2 rounded-xl transition-colors">
            <Download size={13} /> JSON
          </button>

          {canEdit && (
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-3 py-2 rounded-xl transition-colors">
              <Upload size={13} /> Load
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

          {/* Print buttons */}
          <button onClick={() => handlePrint('client')}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm px-4 py-2 rounded-xl transition-colors">
            <Printer size={13} /> Client PDF
          </button>
          {isDirector && (
            <button onClick={() => handlePrint('internal')}
              className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-xl transition-colors">
              <Printer size={13} /> Internal
            </button>
          )}
        </div>
      </div>

      {/* ── AI BRIEF PARSER ─────────────────────────────────────── */}
      {showAI && (
        <div className="bg-gray-900 border border-purple-900 rounded-2xl p-4 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <p className="text-purple-400 font-semibold text-sm flex items-center gap-2">
              <Wand2 size={14} /> AI Brief Parser
            </p>
            <button onClick={() => setShowAI(false)} className="text-gray-500 hover:text-white text-xs">✕ Close</button>
          </div>

          {/* File upload option */}
          <div className="mb-3 p-3 bg-gray-800/60 border border-gray-700 rounded-xl flex items-center justify-between gap-3">
            <div>
              <p className="text-gray-300 text-sm font-medium">Upload Element Sheet</p>
              <p className="text-gray-500 text-xs mt-0.5">.xlsx, .xls, .csv, .docx supported</p>
            </div>
            <button
              onClick={() => aiFileRef.current?.click()}
              disabled={aiLoading}
              className="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-600 text-white text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <Upload size={13} /> {aiLoading ? 'Parsing...' : 'Upload File'}
            </button>
            <input
              ref={aiFileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.docx,.doc,.txt"
              onChange={handleAIFileUpload}
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-gray-600 text-xs">or paste text</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          <textarea
            value={aiBrief}
            onChange={e => setAiBrief(e.target.value)}
            rows={5}
            placeholder="Paste the client brief, RFQ, tender document, or WhatsApp requirements here..."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-300 text-sm focus:outline-none focus:border-purple-500 resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-gray-500 text-xs">AI will extract all items and suggest rows. You review and edit before saving.</p>
            <button onClick={handleParseBrief} disabled={aiLoading || !aiBrief.trim()}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm px-5 py-2 rounded-xl transition-colors disabled:opacity-50">
              <Wand2 size={13} /> {aiLoading ? 'Parsing...' : 'Parse & Add Rows'}
            </button>
          </div>
        </div>
      )}

      {/* ── PAYMENT MILESTONES PANEL ────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden print:hidden">
        <button
          onClick={() => setShowMilestones(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-800 transition-colors">
          <span className="text-amber-400 font-semibold text-sm">
            Payment Schedule
            {milestonesTotal !== 100 && (
              <span className="ml-2 text-red-400 text-xs font-normal">
                ({milestonesTotal}% — should be 100%)
              </span>
            )}
            {milestonesTotal === 100 && grandTotal > 0 && (
              <span className="ml-2 text-gray-500 text-xs font-normal">
                (3 milestones · total ₹{fmt(grandTotal)})
              </span>
            )}
          </span>
          {showMilestones ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </button>
        {showMilestones && (
          <div className="px-5 pb-4 space-y-2">
            {milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  value={m.label}
                  onChange={e => updateMilestone(i, { label: e.target.value })}
                  disabled={!canEdit || lockDone}
                  placeholder="Milestone label"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-300 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50"
                />
                <div className="flex items-center gap-1 w-20">
                  <input
                    type="number" value={m.percent} min="0" max="100"
                    onChange={e => updateMilestone(i, { percent: Number(e.target.value) })}
                    disabled={!canEdit || lockDone}
                    className="w-14 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-center text-amber-400 text-sm focus:outline-none disabled:opacity-50"
                  />
                  <span className="text-gray-500 text-xs">%</span>
                </div>
                {grandTotal > 0 && (
                  <span className="text-gray-400 text-xs w-28 text-right">
                    ₹ {fmt(grandTotal * m.percent / 100)}
                  </span>
                )}
                <input
                  type="date" value={m.due_date}
                  onChange={e => updateMilestone(i, { due_date: e.target.value })}
                  disabled={!canEdit || lockDone}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-400 text-xs focus:outline-none disabled:opacity-50"
                />
                {canEdit && !lockDone && (
                  <button onClick={() => removeMilestone(i)} className="text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
            {canEdit && !lockDone && (
              <button onClick={addMilestone}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-400 transition-colors mt-1">
                <Plus size={11} /> Add milestone
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── COMPLIANCE PANEL ────────────────────────────────────── */}
      {isDirector && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden print:hidden">
          <button
            onClick={() => setShowCompliance(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-800 transition-colors">
            <span className="text-gray-400 font-semibold text-sm">Compliance Details (GST · PAN · Bank · TDS)</span>
            {showCompliance ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
          </button>
          {showCompliance && (
            <div className="px-5 pb-4 grid grid-cols-2 gap-3">
              {([
                ['gst_no', 'GST Number'],
                ['pan', 'PAN'],
                ['msme', 'MSME/Udyam'],
                ['bank_name', 'Bank Name'],
                ['account_no', 'Account No.'],
                ['ifsc', 'IFSC Code'],
                ['tds', 'TDS Clause'],
              ] as [keyof Compliance, string][]).map(([key, label]) => (
                <div key={key}>
                  <label className="text-gray-500 text-xs mb-1 block">{label}</label>
                  <input
                    value={compliance[key]}
                    onChange={e => setCompliance(prev => ({ ...prev, [key]: e.target.value }))}
                    disabled={lockDone}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-300 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          QUOTATION DOCUMENT
      ══════════════════════════════════════════════════════════ */}
      <div
        className="rounded-2xl overflow-hidden shadow-2xl print:shadow-none print:rounded-none"
        id="quotation-doc"
        style={{ background: docBg, color: isClientPrint ? '#2d2d2d' : '#1a1a2e', fontFamily: isClientPrint ? "'Georgia', serif" : 'inherit' }}>

        {/* ── LETTERHEAD ────────────────────────────────────────── */}
        <div className="px-8 py-6 flex items-start justify-between" style={{ background: internalBg }}>
          <div>
            <p className="font-black text-lg tracking-widest uppercase" style={{ color: gold }}>{co.name}</p>
            <p className="text-xs mt-1" style={{ color: '#aab' }}>{co.tagline}</p>
            <p className="text-xs mt-2" style={{ color: '#ccc' }}>{co.contact}</p>
          </div>
          <div className="text-right">
            <p className="font-black text-xl tracking-widest" style={{ color: gold }}>QUOTATION</p>
            <div className="text-xs mt-2 space-y-0.5" style={{ color: '#ccc' }}>
              <p>No: <span className="text-white font-semibold">{qNum}</span></p>
              <p>Date: {today}</p>
              <p>Valid till: {validUntil}</p>
            </div>
          </div>
        </div>

        {/* ── CLIENT + EVENT ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 border-b-2" style={{ borderColor: isClientPrint ? '#e8d5a3' : internalBg, background: docBg }}>
          <div className="px-8 py-4 border-r" style={{ borderColor }}>
            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: gold }}>Client Details</p>
            <div className="space-y-1 text-sm">
              {[
                ['Client / Company', clientName],
                ['Contact Person', clientContact],
                ['Phone', clientPhone],
                ['Email', clientEmail],
              ].map(([lbl, val]) => (
                <div key={lbl} className="flex gap-3">
                  <span className="w-28 flex-shrink-0 text-xs" style={{ color: isClientPrint ? '#a0875a' : '#9ca3af' }}>{lbl}</span>
                  <span className="font-semibold" style={{ color: isClientPrint ? '#2d2d2d' : '#111827' }}>{val || '—'}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-8 py-4">
            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: gold }}>Event Details</p>
            <div className="space-y-1 text-sm">
              <div className="flex gap-3">
                <span className="w-28 flex-shrink-0 text-xs" style={{ color: isClientPrint ? '#a0875a' : '#9ca3af' }}>Event Name</span>
                <span className="font-semibold" style={{ color: isClientPrint ? '#2d2d2d' : '#111827' }}>{eventName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── SCOPE HEADER ──────────────────────────────────────── */}
        <div className="px-8 py-2 text-xs font-black uppercase tracking-widest" style={{ background: internalBg, color: gold }}>
          Scope of Work &amp; Pricing
        </div>

        {/* ── ITEMS TABLE ───────────────────────────────────────── */}
        <table className="w-full border-collapse text-sm" style={{ background: docBg }}>
          <thead>
            <tr style={{ background: tableHeaderBg }}>
              <th className="text-left px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-8 pl-8">#</th>
              <th className="text-left px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide">Element / Item</th>
              <th className="text-left px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide">Specification</th>
              <th className="text-left px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-28">Dimensions</th>
              <th className="text-center px-2 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-14">Days</th>
              <th className="text-center px-2 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-14">Qty</th>
              <th className="text-right px-2 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-24">Rate (₹)</th>
              {/* Vendor cols — internal only */}
              {isDirector && showVendorCol && !isClientPrint && (
                <>
                  <th className="text-right px-2 py-2.5 text-amber-300 text-xs font-bold uppercase tracking-wide w-24 print:hidden">Vend Rate</th>
                  <th className="text-right px-2 py-2.5 text-green-300 text-xs font-bold uppercase tracking-wide w-20 print:hidden">Margin</th>
                  <th className="text-left px-2 py-2.5 text-amber-300 text-xs font-bold uppercase tracking-wide w-28 print:hidden">Vendor</th>
                </>
              )}
              <th className="text-right px-3 py-2.5 pr-8 text-white text-xs font-bold uppercase tracking-wide w-28">Amount (₹)</th>
              <th className="w-6 print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const itemNum = rows.slice(0, i + 1).filter(r => r._type === 'item').length
              if (row._type === 'section') {
                const colSpan = isDirector && showVendorCol && !isClientPrint ? 11 : 8
                return (
                  <tr key={i} style={{ background: internalBg }}>
                    <td colSpan={colSpan} className="px-8 py-2">
                      <input
                        value={row.label || ''}
                        onChange={e => updateRow(i, { label: e.target.value })}
                        disabled={!canEdit || lockDone}
                        placeholder="— Section Header —"
                        className="bg-transparent text-xs font-black uppercase tracking-widest w-full focus:outline-none print:pointer-events-none disabled:opacity-70"
                        style={{ color: gold }}
                      />
                    </td>
                    <td className="print:hidden" style={{ background: internalBg }}>
                      {canEdit && !lockDone && (
                        <button onClick={() => removeRow(i)} className="text-gray-600 hover:text-red-400 transition-colors px-1">✕</button>
                      )}
                    </td>
                  </tr>
                )
              }

              const amt = rowAmount(row)
              const vCost = rowVendorCost(row)
              const margin = amt - vCost
              const vendorName = vendors.find(v => v.id === row.vendor_id)?.name || ''

              return (
                <tr key={i} className="border-b group hover:bg-amber-50 transition-colors"
                  style={{ background: i % 2 === 0 ? rowEvenBg : rowOddBg, borderColor }}>
                  <td className="px-3 py-2 text-gray-400 text-xs text-center pl-8">{itemNum}</td>
                  <td className="px-3 py-2">
                    {row.is_lumpsum && (
                      <span className="text-xs text-amber-600 font-semibold mr-1">[LS]</span>
                    )}
                    <input value={row.description || ''} onChange={e => updateRow(i, { description: e.target.value })}
                      disabled={!canEdit || lockDone} placeholder="Element name..."
                      className={inputCls + ' disabled:opacity-70'} />
                  </td>
                  <td className="px-3 py-2">
                    <input value={row.specs || ''} onChange={e => updateRow(i, { specs: e.target.value })}
                      disabled={!canEdit || lockDone} placeholder="Spec / material..."
                      className={inputCls + ' disabled:opacity-70'} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-0.5">
                      <input value={row.dim_str || ''} onChange={e => updateRow(i, { dim_str: e.target.value })}
                        disabled={!canEdit || lockDone} placeholder="20×10 ft"
                        className={inputCls + ' disabled:opacity-70 text-xs'} />
                      {(row.area_sqft || 0) > 0 && (
                        <p className="text-xs text-gray-400">{row.area_sqft} sq.ft</p>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" value={row.days ?? 1} min="0"
                      onChange={e => updateRow(i, { days: Number(e.target.value) })}
                      disabled={!canEdit || lockDone}
                      className="text-center text-sm focus:outline-none w-12 bg-transparent text-gray-900 print:pointer-events-none disabled:opacity-70" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" value={row.qty ?? 1} min="0"
                      onChange={e => updateRow(i, { qty: Number(e.target.value) })}
                      disabled={!canEdit || lockDone}
                      className="text-center text-sm focus:outline-none w-12 bg-transparent text-gray-900 print:pointer-events-none disabled:opacity-70" />
                  </td>
                  <td className="px-2 py-2">
                    {row.is_lumpsum ? (
                      <input type="number" value={row.lump_amount ?? 0} min="0"
                        onChange={e => updateRow(i, { lump_amount: Number(e.target.value) })}
                        disabled={!canEdit || lockDone}
                        placeholder="Fixed amt"
                        className="text-right text-sm focus:outline-none w-24 bg-amber-50 text-amber-700 font-semibold rounded px-1 print:pointer-events-none disabled:opacity-70" />
                    ) : (
                      <input type="number" value={row.rate ?? 0} min="0"
                        onChange={e => updateRow(i, { rate: Number(e.target.value) })}
                        disabled={!canEdit || lockDone}
                        className="text-right text-sm focus:outline-none w-20 bg-transparent text-gray-900 print:pointer-events-none disabled:opacity-70" />
                    )}
                  </td>

                  {/* Vendor columns — internal only */}
                  {isDirector && showVendorCol && !isClientPrint && (
                    <>
                      <td className="px-2 py-2 print:hidden">
                        {!row.is_lumpsum && (
                          <input type="number" value={row.vendor_rate ?? 0} min="0"
                            onChange={e => updateRow(i, { vendor_rate: Number(e.target.value) })}
                            disabled={lockDone}
                            className="text-right text-sm focus:outline-none w-20 bg-amber-50 text-amber-700 rounded px-1 print:pointer-events-none disabled:opacity-70" />
                        )}
                      </td>
                      <td className="px-2 py-2 text-right print:hidden">
                        <span className={`text-xs font-semibold ${margin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {margin > 0 ? '+' : ''}{margin ? `₹${fmt(margin)}` : '—'}
                        </span>
                      </td>
                      <td className="px-2 py-2 print:hidden">
                        <select
                          value={row.vendor_id || ''}
                          onChange={e => updateRow(i, { vendor_id: e.target.value })}
                          disabled={lockDone}
                          className="bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 w-28 focus:outline-none focus:border-amber-400 disabled:opacity-70 py-0.5">
                          <option value="">— Vendor —</option>
                          {vendors.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </td>
                    </>
                  )}

                  <td className="px-3 py-2 pr-8 text-right font-semibold" style={{ color: isClientPrint ? '#a0875a' : '#374151' }}>
                    {amt ? `₹ ${fmt(amt)}` : '—'}
                  </td>
                  <td className="print:hidden">
                    {canEdit && !lockDone && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        {/* Lumpsum toggle */}
                        <button
                          onClick={() => updateRow(i, { is_lumpsum: !row.is_lumpsum })}
                          className={`text-xs px-1 py-0.5 rounded transition-colors ${row.is_lumpsum ? 'bg-amber-200 text-amber-700' : 'text-gray-400 hover:text-amber-500'}`}
                          title="Toggle Lumpsum">LS</button>
                        <button onClick={() => removeRow(i)}
                          className="text-gray-300 hover:text-red-400 transition-all px-1">✕</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* ── ADD ROW BAR ───────────────────────────────────────── */}
        {canEdit && !lockDone && (
          <div className="flex gap-3 px-8 py-2.5 border-t print:hidden"
            style={{ background: isClientPrint ? '#fdf6e3' : '#f9fafb', borderColor }}>
            <button onClick={addItem}
              className="flex items-center gap-1.5 text-xs font-bold border border-dashed px-4 py-1.5 rounded transition-colors"
              style={{ borderColor: gold, color: gold }}>
              <Plus size={11} /> Add Row
            </button>
            <button onClick={addSection}
              className="flex items-center gap-1.5 text-xs font-bold border border-dashed border-gray-400 text-gray-500 px-4 py-1.5 rounded hover:border-gray-600 transition-colors">
              <ListPlus size={11} /> Section Header
            </button>
          </div>
        )}

        {/* ── GST / DISCOUNT OPTIONS ────────────────────────────── */}
        {canEdit && (
          <div className="flex items-center justify-end gap-4 px-8 py-2 text-xs text-gray-600 print:hidden"
            style={{ background: isClientPrint ? '#fdf6e3' : undefined, borderTop: `1px solid ${borderColor}` }}>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showDiscount} onChange={e => setShowDiscount(e.target.checked)}
                disabled={lockDone} />
              Discount
            </label>
            <label className="flex items-center gap-1.5">
              GST:
              <select value={gstMode} onChange={e => setGstMode(e.target.value as GSTMode)}
                disabled={lockDone}
                className="border border-gray-300 rounded px-2 py-1 text-xs ml-1 focus:outline-none disabled:opacity-50">
                <option value="none">No GST</option>
                <option value="exclusive">+18% GST (exclusive)</option>
                <option value="inclusive">18% GST (inclusive)</option>
              </select>
            </label>
          </div>
        )}

        {/* ── TOTALS ────────────────────────────────────────────── */}
        <div className="flex justify-end px-8 pb-6 pt-2 border-t-2"
          style={{ borderColor: internalBg, background: docBg }}>
          <div className="w-80 space-y-1.5 text-sm">
            <div className="flex justify-between py-1 border-b" style={{ borderColor }}>
              <span style={{ color: isClientPrint ? '#6b5b45' : '#6b7280' }}>Subtotal</span>
              <span className="font-semibold">₹ {fmt(subtotal)}</span>
            </div>

            {/* Vendor cost + margin — internal only */}
            {isDirector && !isClientPrint && totalVendorCost > 0 && (
              <>
                <div className="flex justify-between py-1 border-b text-xs print:hidden" style={{ borderColor }}>
                  <span className="text-amber-600">Vendor Cost</span>
                  <span className="text-amber-600 font-semibold">₹ {fmt(totalVendorCost)}</span>
                </div>
                <div className="flex justify-between py-1 border-b text-xs print:hidden" style={{ borderColor }}>
                  <span className="text-green-600">Gross Margin</span>
                  <span className="text-green-600 font-semibold">
                    ₹ {fmt(totalMargin)} ({subtotal > 0 ? Math.round(totalMargin / subtotal * 100) : 0}%)
                  </span>
                </div>
              </>
            )}

            {showDiscount && (
              <div className="flex items-center justify-between py-1 border-b" style={{ borderColor }}>
                <span className="text-red-600 flex items-center gap-2">
                  Discount
                  {canEdit && !lockDone ? (
                    <>
                      <input type="number" value={discountPct} min="0" max="100"
                        onChange={e => setDiscountPct(Number(e.target.value))}
                        className="w-14 border border-red-300 rounded px-1 py-0.5 text-xs text-center focus:outline-none" /> %
                    </>
                  ) : (
                    <span>{discountPct}%</span>
                  )}
                </span>
                <span className="text-red-600 font-semibold">- ₹ {fmt(discountAmt)}</span>
              </div>
            )}

            {gstMode !== 'none' && (
              <div className="flex justify-between py-1 border-b" style={{ borderColor }}>
                <span style={{ color: isClientPrint ? '#6b5b45' : '#6b7280' }}>
                  GST 18% ({gstMode === 'exclusive' ? 'added' : 'included'})
                </span>
                <span className="font-semibold">₹ {fmt(gstAmt)}</span>
              </div>
            )}

            <div className="flex justify-between py-2 px-3 rounded-lg mt-2" style={{ background: internalBg }}>
              <span className="font-black uppercase tracking-wide text-xs" style={{ color: gold }}>Grand Total</span>
              <span className="font-black text-white text-base">₹ {fmt(grandTotal)}</span>
            </div>

            {grandTotal > 0 && (
              <p className="text-right text-xs italic" style={{ color: isClientPrint ? '#a0875a' : '#9ca3af' }}>
                Rupees {numToWords(Math.round(grandTotal))} Only
              </p>
            )}
          </div>
        </div>

        {/* ── PAYMENT SCHEDULE (in document) ───────────────────── */}
        {milestones.length > 0 && grandTotal > 0 && (
          <div className="px-8 py-5 border-t" style={{ borderColor, background: isClientPrint ? '#fdf6e3' : '#f9fafb' }}>
            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: gold }}>Payment Schedule</p>
            <div className="space-y-1">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span style={{ color: isClientPrint ? '#6b5b45' : '#6b7280' }}>{m.label}</span>
                  <div className="flex items-center gap-4">
                    {m.due_date && (
                      <span className="text-xs" style={{ color: isClientPrint ? '#a0875a' : '#9ca3af' }}>
                        Due: {new Date(m.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    <span className="font-semibold w-28 text-right">₹ {fmt(grandTotal * m.percent / 100)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── NOTES / T&C ───────────────────────────────────────── */}
        <div className="px-8 py-5 border-t" style={{ borderColor, background: isClientPrint ? '#fdf6e3' : '#f9fafb' }}>
          <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: isClientPrint ? '#a0875a' : '#6b7280' }}>Notes / Terms &amp; Conditions</p>
          {canEdit && !lockDone ? (
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
              placeholder="Payment terms, cancellation policy, GST notes..."
              className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none resize-none print:border-0 print:p-0 print:bg-transparent"
              style={{ borderColor, color: isClientPrint ? '#6b5b45' : '#4b5563', background: 'transparent' }} />
          ) : (
            <p className="text-xs whitespace-pre-wrap" style={{ color: isClientPrint ? '#6b5b45' : '#4b5563' }}>{notes}</p>
          )}
          <p className="text-xs mt-2" style={{ color: isClientPrint ? '#a0875a' : '#6b7280' }}>Valid until: {validUntil}</p>
        </div>

        {/* ── COMPLIANCE BLOCK ──────────────────────────────────── */}
        {(compliance.gst_no || compliance.pan || compliance.account_no) && (
          <div className="px-8 py-4 border-t grid grid-cols-2 gap-4" style={{ borderColor, background: isClientPrint ? '#fdf6e3' : '#f9fafb' }}>
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: gold }}>Our Details</p>
              <div className="space-y-0.5 text-xs" style={{ color: isClientPrint ? '#6b5b45' : '#6b7280' }}>
                {compliance.gst_no && <p>GST: {compliance.gst_no}</p>}
                {compliance.pan && <p>PAN: {compliance.pan}</p>}
                {compliance.msme && <p>MSME: {compliance.msme}</p>}
                {compliance.tds && <p>{compliance.tds}</p>}
              </div>
            </div>
            {compliance.account_no && (
              <div>
                <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: gold }}>Bank Details</p>
                <div className="space-y-0.5 text-xs" style={{ color: isClientPrint ? '#6b5b45' : '#6b7280' }}>
                  {compliance.bank_name && <p>Bank: {compliance.bank_name}</p>}
                  <p>A/c: {compliance.account_no}</p>
                  {compliance.ifsc && <p>IFSC: {compliance.ifsc}</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SIGNATURE BLOCK ───────────────────────────────────── */}
        <div className="px-8 py-6 border-t grid grid-cols-2 gap-8" style={{ borderColor, background: docBg }}>
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-6" style={{ color: gold }}>For {co.name}</p>
            <div className="border-t mt-8 pt-2" style={{ borderColor }}>
              <p className="text-xs" style={{ color: isClientPrint ? '#a0875a' : '#9ca3af' }}>Authorised Signatory</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-6" style={{ color: isClientPrint ? '#a0875a' : '#6b7280' }}>Client Acceptance</p>
            <div className="border-t mt-8 pt-2" style={{ borderColor }}>
              <p className="text-xs" style={{ color: isClientPrint ? '#a0875a' : '#9ca3af' }}>Client Signature &amp; Stamp</p>
            </div>
          </div>
        </div>

        {/* ── FOOTER ────────────────────────────────────────────── */}
        <div className="px-8 py-3 flex items-center justify-between border-t" style={{ background: internalBg }}>
          <p className="text-xs" style={{ color: '#888' }}>{co.footer}</p>
          <p className="text-xs" style={{ color: '#888' }}>#{qNum}</p>
        </div>
      </div>
    </div>
  )
}
