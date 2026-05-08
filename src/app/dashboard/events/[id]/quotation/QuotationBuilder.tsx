'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Printer, Save, Send, Upload, ListPlus,
  Lock, Wand2, ChevronDown, ChevronUp, Eye, EyeOff, CheckCircle2, Copy, Check, MessageSquare,
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
  service_fee?: number
}

interface ClientTokenStatus {
  status: string
  clientDecision?: string
  clientNote?: string
  decidedAt?: string
}

interface Props {
  eventId: string
  eventName: string
  eventType?: string
  eventCity?: string
  eventDate?: string
  clientName?: string
  clientContact?: string
  clientPhone?: string
  clientEmail?: string
  existingQuotation?: any
  eventElements: any[]
  vendors: { id: string; name: string; category?: string }[]
  userRole: string
  clientTokenStatus?: ClientTokenStatus
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

function parseDimStr(s: string): number {
  if (!s) return 0
  const lower = s.toLowerCase().trim()
  if (lower === 'lumpsum' || lower === 'ls') return 0
  // running feet — check before stripping units
  const rftMatch = lower.match(/([\d.]+)\s*(?:rft|running\s*ft|r\.?ft\.?)/)
  if (rftMatch) return parseFloat(rftMatch[1])
  // strip unit words so "20 ft × 10 ft", "20'×10'" etc. all work
  const stripped = lower.replace(/\bfeet\b|\bfoot\b|\bft\b|\bmtr\b|'|"/g, '').trim()
  // WxH (handles "20×10", "20 x 10", "20*10", "20 x 10 ft")
  const dimMatch = stripped.match(/([\d.]+)\s*[×x*]\s*([\d.]+)/)
  if (dimMatch) return parseFloat(dimMatch[1]) * parseFloat(dimMatch[2])
  // single number — skip if it's a quantity (nos, pcs, unit)
  if (!/\b(?:nos?|pcs?|unit|set|panel)\b/.test(lower)) {
    const num = parseFloat(lower)
    if (!isNaN(num)) return num
  }
  return 0
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

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-IN')
}

function toTitleCase(s: string) {
  if (!s) return s
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
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
  eventId, eventName, eventType, eventCity, eventDate,
  clientName, clientContact, clientPhone, clientEmail,
  existingQuotation, eventElements, vendors, userRole, clientTokenStatus,
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
  const [validity] = useState(existing?.validity_days ?? 7)
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
  const [lockResult, setLockResult] = useState<{ elementsCreated: number; vendorSOsCreated: number; milestonesCreated: number } | null>(null)
  const [showMilestones, setShowMilestones] = useState(true)
  const [showCompliance, setShowCompliance] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [aiBrief, setAiBrief] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [ratesFilling, setRatesFilling] = useState(false)
  const [ratesFillNote, setRatesFillNote] = useState('')
  const [shareLink, setShareLink] = useState('')
  const [shareCopied, setShareCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [showVendorCol, setShowVendorCol] = useState(false)
  const [serviceFee, setServiceFee] = useState<number>(Number(existing?.compliance?.service_fee) || 0)
  const [showServiceFee, setShowServiceFee] = useState((Number(existing?.compliance?.service_fee) || 0) > 0)
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
  const serviceFeeAmt = showServiceFee ? serviceFee : 0
  const taxableAmount = afterDiscount + serviceFeeAmt
  const gstAmt = gstMode === 'exclusive' ? taxableAmount * 0.18
    : gstMode === 'inclusive' ? taxableAmount * 18 / 118
    : 0
  const grandTotal = gstMode === 'exclusive' ? taxableAmount + gstAmt : taxableAmount

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
      compliance: { ...compliance, service_fee: showServiceFee ? serviceFee : 0 },
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
    const itemCount = rows.filter(r => r._type === 'item' && r.description?.trim()).length
    if (itemCount === 0) {
      alert('Quotation has no items. Add elements before locking.')
      return
    }
    if (!confirm(`Lock this quotation?\n\n• ${itemCount} elements will be generated\n• Payment milestones will be created\n• Vendor SOs will be generated\n• Event will be set to Active\n• Team will be notified\n\nThis cannot be undone.`)) return

    setLocking(true)
    await save()
    const res = await fetch(`/api/quotations/${quoteId}/lock`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setLockDone(true)
      setStatus('accepted')
      setLockResult({ elementsCreated: data.elementsCreated ?? 0, vendorSOsCreated: data.vendorSOsCreated ?? 0, milestonesCreated: data.milestonesCreated ?? 0 })
      if (data.elementError) {
        alert(`Warning: Elements could not be saved.\nError: ${data.elementError}\n\nPlease contact support or check Supabase RLS policies on the elements table.`)
      } else if (data.itemRowsFound > 0 && data.elementsCreated === 0) {
        alert(`Warning: ${data.itemRowsFound} items found but 0 elements were created. Check elements table permissions.`)
      }
    } else {
      alert(data.error || 'Lock failed')
    }
    setLocking(false)
    router.refresh()
  }

  // ── Share with Client ──────────────────────────────────────────
  async function handleShare() {
    if (!quoteId) { alert('Save the quotation first.'); return }
    setSharing(true)
    const res = await fetch(`/api/quotations/${quoteId}/share`, { method: 'POST' })
    const data = await res.json()
    if (data.link) setShareLink(data.link)
    setSharing(false)
  }

  async function copyShareLink() {
    await navigator.clipboard.writeText(shareLink)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  // ── AI Rate Fill ───────────────────────────────────────────────
  async function handleFillRates() {
    const priceable = rows.filter(r => r._type === 'item' && r.description?.trim() && !r.is_lumpsum)
    if (!priceable.length) return
    setRatesFilling(true)
    setRatesFillNote('')
    try {
      const res = await fetch('/api/ai/fill-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (data.suggestions?.length) {
        // Map suggestions back onto rows by index position among item rows
        const itemIndices: number[] = []
        rows.forEach((r, i) => { if (r._type === 'item' && r.description?.trim() && !r.is_lumpsum) itemIndices.push(i) })
        setRows(prev => {
          const next = [...prev]
          data.suggestions.forEach((s: any) => {
            const rowIdx = itemIndices[s.index - 1]
            if (rowIdx === undefined) return
            next[rowIdx] = { ...next[rowIdx], rate: s.client_rate || next[rowIdx].rate, vendor_rate: s.vendor_rate || next[rowIdx].vendor_rate }
          })
          return next
        })
        setRatesFillNote(`AI filled rates for ${data.suggestions.length} items. Review and adjust before saving.`)
        setTimeout(() => setRatesFillNote(''), 5000)
      } else {
        setRatesFillNote(data.error || 'No rate suggestions returned.')
        setTimeout(() => setRatesFillNote(''), 4000)
      }
    } catch {
      setRatesFillNote('Rate fill failed — check connection.')
      setTimeout(() => setRatesFillNote(''), 4000)
    }
    setRatesFilling(false)
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
        setRows(prev => {
          const nonEmpty = prev.filter(r => r._type === 'section' || r.description?.trim())
          return [...nonEmpty, ...parsed]
        })
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
        setRows(prev => {
          const nonEmpty = prev.filter(r => r._type === 'section' || r.description?.trim())
          return [...nonEmpty, ...parsed]
        })
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

  // ── Download Blank CSV Template ────────────────────────────────
  function downloadTemplate() {
    const headers = [
      'Type (item/section)',
      'Description / Element Name',
      'Specification / Details',
      'Dimensions (20x10 ft / 15 rft / Lumpsum)',
      'Days',
      'Qty',
      'Client Rate (₹)',
      'Vendor Rate (₹)',
      'Is Lumpsum (yes/no)',
      'Lumpsum Amount (₹)',
    ]
    const examples: string[][] = [
      ['section', 'STAGE & BACKDROP', '', '', '', '', '', '', '', ''],
      ['item', 'Main Stage Setup', 'Wooden stage, carpeted surface', '20x10 ft', '1', '1', '50000', '35000', 'no', ''],
      ['item', 'Backdrop Flex Print', 'Single side UV print, iron frame', '20x8 ft', '1', '1', '12000', '8000', 'no', ''],
      ['section', 'AUDIO VISUAL', '', '', '', '', '', '', '', ''],
      ['item', 'LED Screen P3.9', 'Indoor grade, truss mounted', '10x8 ft', '1', '1', '80000', '60000', 'no', ''],
      ['item', 'PA Sound System', 'Complete audio package - lumpsum', 'Lumpsum', '1', '1', '', '', 'yes', '65000'],
      ['section', 'FURNITURE', '', '', '', '', '', '', '', ''],
      ['item', 'Banquet Chair', 'White padded, stackable', '', '1', '100', '150', '100', 'no', ''],
      ['item', 'Cocktail Table', 'Round 4ft, draped', '', '1', '20', '500', '300', 'no', ''],
    ]
    const instructionLines = [
      '# CEE Quotation Template — Fill this file and upload via "AI: Parse Brief > Upload Sheet"',
      '# TYPE column: use "item" for elements, "section" for category headers (section rows ignore all other columns)',
      '# DIMENSIONS: write like "20x10 ft", "15 rft", or leave blank for quantity-based items',
      '# LUMPSUM: if the whole item is a fixed cost, set Is Lumpsum = yes and fill Lumpsum Amount — leave Client Rate blank',
      '# VENDOR RATE is internal only — client will not see it',
      '#',
    ]
    const csvRows = [
      ...instructionLines,
      headers.map(h => `"${h}"`).join(','),
      ...examples.map(row => row.map(v => `"${v}"`).join(',')),
    ]
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `CEE_Quote_Template_${(eventName || 'Event').replace(/[^a-z0-9]/gi, '_')}.csv`
    a.click()
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

      {/* ── ROW 1: STATUS + SEND ACTIONS ─────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap print:hidden">
        {/* Company */}
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
          {lockDone ? '🔒 Locked' : status.charAt(0).toUpperCase() + status.slice(1)}
        </span>

        {lockDone && (
          <span className="flex items-center gap-1.5 text-green-400 text-xs">
            <CheckCircle2 size={13} />
            {lockResult
              ? `${lockResult.elementsCreated} elements · ${lockResult.vendorSOsCreated} SOs · ${lockResult.milestonesCreated} milestones created`
              : 'Locked — elements & tasks generated'}
          </span>
        )}

        {/* Right: send/finalize actions */}
        <div className="flex items-center gap-2 ml-auto">
          {canEdit && !lockDone && (
            <button onClick={() => save()} disabled={saving}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
              <Save size={13} /> {saving ? 'Saving…' : 'Save'}
            </button>
          )}

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

          {/* Share link */}
          {isDirector && quoteId && (
            shareLink ? (
              <div className="flex items-center gap-1.5">
                <input readOnly value={shareLink}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-300 text-xs w-44 focus:outline-none"
                  onFocus={e => e.target.select()} />
                <button onClick={copyShareLink}
                  className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-3 py-2 rounded-xl transition-colors flex-shrink-0">
                  {shareCopied ? <><Check size={11} className="text-green-400" /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
            ) : (
              <button onClick={handleShare} disabled={sharing}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50 font-medium">
                <Send size={13} /> {sharing ? 'Generating…' : 'Share with Client'}
              </button>
            )
          )}

          {isDirector && !lockDone && quoteId && (
            <button onClick={handleLock} disabled={locking}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm px-5 py-2 rounded-xl transition-colors disabled:opacity-50">
              <Lock size={13} /> {locking ? 'Locking…' : 'Lock & Activate'}
            </button>
          )}

          <button onClick={() => handlePrint('client')}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-3 py-2 rounded-xl transition-colors">
            <Printer size={13} /> PDF
          </button>
          {isDirector && (
            <button onClick={() => handlePrint('internal')}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs px-3 py-2 rounded-xl transition-colors">
              Internal
            </button>
          )}
        </div>
      </div>

      {/* ── CLIENT DECISION BANNER ───────────────────────────────── */}
      {clientTokenStatus?.clientDecision && (
        <div className={`rounded-2xl border px-5 py-4 print:hidden ${
          clientTokenStatus.clientDecision === 'accepted'
            ? 'bg-green-950/60 border-green-800'
            : 'bg-blue-950/60 border-blue-800'
        }`}>
          <div className="flex items-start gap-3">
            {clientTokenStatus.clientDecision === 'accepted'
              ? <CheckCircle2 size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
              : <MessageSquare size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${clientTokenStatus.clientDecision === 'accepted' ? 'text-green-400' : 'text-blue-400'}`}>
                {clientTokenStatus.clientDecision === 'accepted' ? 'Client Accepted the Quotation' : 'Client Requested Changes'}
              </p>
              {clientTokenStatus.decidedAt && (
                <p className="text-gray-500 text-xs mt-0.5">
                  {new Date(clientTokenStatus.decidedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              {clientTokenStatus.clientNote && (() => {
                let parsed: any = null
                try { parsed = JSON.parse(clientTokenStatus.clientNote!) } catch {}
                if (parsed?.general !== undefined) {
                  return (
                    <div className="mt-2 space-y-2">
                      {parsed.general && <p className="text-gray-300 text-sm italic">"{parsed.general}"</p>}
                      {parsed.items?.filter((it: any) => it.suggestedAmount || it.comment).length > 0 && (
                        <div className="bg-black/20 rounded-xl px-3 py-2.5 space-y-2">
                          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Per-item feedback</p>
                          {parsed.items.filter((it: any) => it.suggestedAmount || it.comment).map((it: any, i: number) => (
                            <div key={i} className="text-xs space-y-0.5">
                              <p className="font-medium text-gray-300">{it.description}</p>
                              {it.suggestedAmount && <p className="text-amber-400">Suggested amount: ₹{Number(it.suggestedAmount).toLocaleString('en-IN')}</p>}
                              {it.comment && <p className="text-gray-400 italic">"{it.comment}"</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
                return <p className="text-gray-300 text-sm italic mt-1.5">"{clientTokenStatus.clientNote}"</p>
              })()}
              {clientTokenStatus.clientDecision === 'accepted' && (
                <p className="text-green-400/70 text-xs mt-2">Ready to lock → Lock &amp; Activate will generate elements, SOs and payments.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ROW 2: BUILD TOOLS (only when editing) ───────────────── */}
      {canEdit && !lockDone && (
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {/* AI tools — prominent */}
          <button onClick={() => setShowAI(v => !v)}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl border transition-colors font-medium ${
              showAI
                ? 'bg-purple-600 border-purple-500 text-white'
                : 'bg-purple-950/50 border-purple-800/50 text-purple-400 hover:bg-purple-950 hover:border-purple-700'
            }`}>
            <Wand2 size={14} /> AI: Parse Brief / Upload Sheet
          </button>

          {rows.some(r => r._type === 'item' && r.description?.trim() && !r.is_lumpsum) && isDirector && (
            <button onClick={handleFillRates} disabled={ratesFilling}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border bg-green-950/50 border-green-800/50 text-green-400 hover:bg-green-950 hover:border-green-700 transition-colors font-medium disabled:opacity-50">
              <Wand2 size={14} /> {ratesFilling ? 'Filling rates…' : 'AI: Fill Rates'}
            </button>
          )}

          {eventElements.length > 0 && (
            <button onClick={importFromElements}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border bg-amber-950/30 border-amber-800/40 text-amber-400 hover:bg-amber-950/60 transition-colors font-medium">
              <ListPlus size={14} /> Import Elements
            </button>
          )}

          {/* Divider */}
          <div className="h-6 w-px bg-gray-700 mx-1" />

          {/* Table controls */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={showDiscount} onChange={e => setShowDiscount(e.target.checked)} disabled={lockDone} />
              Discount
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={showServiceFee} onChange={e => setShowServiceFee(e.target.checked)} disabled={lockDone} />
              Agency Fee
            </label>
            <select value={gstMode} onChange={e => setGstMode(e.target.value as GSTMode)} disabled={lockDone}
              className="bg-gray-900 border border-gray-700 text-gray-400 text-xs rounded-lg px-2 py-1.5 focus:outline-none disabled:opacity-50">
              <option value="none">No GST</option>
              <option value="exclusive">+18% GST</option>
              <option value="inclusive">18% included</option>
            </select>
            {isDirector && (
              <button onClick={() => setShowVendorCol(v => !v)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  showVendorCol ? 'border-amber-700 text-amber-400 bg-amber-950/30' : 'border-gray-700 text-gray-500 hover:border-gray-600'
                }`}>
                {showVendorCol ? <Eye size={11} /> : <EyeOff size={11} />} Vendor
              </button>
            )}
          </div>

          {/* Template + JSON backup */}
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={downloadTemplate} className="text-xs text-amber-600 hover:text-amber-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-800 border border-amber-900/50">⬇ Template</button>
            <button onClick={exportJSON} className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-800">Export JSON</button>
            <button onClick={() => fileInputRef.current?.click()} className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-800">Load JSON</button>
          </div>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>
      )}

      {/* ── AI RATE FILL FEEDBACK ───────────────────────────────── */}
      {ratesFillNote && (
        <div className="bg-green-950 border border-green-800/50 rounded-xl px-4 py-2.5 text-green-400 text-xs print:hidden">
          {ratesFillNote}
        </div>
      )}

      {/* ── AI BRIEF PARSER ─────────────────────────────────────── */}
      {showAI && (
        <div className="bg-gray-900 border border-purple-800/60 rounded-2xl p-5 print:hidden">
          <div className="flex items-center justify-between mb-4">
            <p className="text-purple-300 font-semibold flex items-center gap-2">
              <Wand2 size={15} /> AI Brief Parser
            </p>
            <button onClick={() => setShowAI(false)} className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors">✕ Close</button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-gray-800/60 border border-gray-700 rounded-xl">
              <p className="text-gray-200 text-sm font-semibold mb-1">Upload Element Sheet</p>
              <p className="text-gray-500 text-xs mb-3">.xlsx, .xls, .csv, .docx — AI reads and extracts all rows</p>
              <button onClick={() => aiFileRef.current?.click()} disabled={aiLoading}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50 font-medium w-full justify-center">
                <Upload size={13} /> {aiLoading ? 'Parsing…' : 'Upload File'}
              </button>
              <input ref={aiFileRef} type="file" accept=".xlsx,.xls,.csv,.docx,.doc,.txt" onChange={handleAIFileUpload} className="hidden" />
            </div>
            <div className="p-4 bg-gray-800/60 border border-gray-700 rounded-xl">
              <p className="text-gray-200 text-sm font-semibold mb-1">Paste Brief Text</p>
              <p className="text-gray-500 text-xs mb-3">RFQ, WhatsApp requirements, tender document</p>
              <textarea value={aiBrief} onChange={e => setAiBrief(e.target.value)} rows={3}
                placeholder="Paste client requirements here…"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-gray-300 text-xs focus:outline-none focus:border-purple-500 resize-none mb-2" />
              <button onClick={handleParseBrief} disabled={aiLoading || !aiBrief.trim()}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50 font-medium w-full justify-center">
                <Wand2 size={13} /> {aiLoading ? 'Parsing…' : 'Parse & Add Rows'}
              </button>
            </div>
          </div>
          <p className="text-gray-600 text-xs">AI extracts items, specs, dimensions and adds them as rows. Review and edit everything before saving.</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          QUOTATION DOCUMENT
      ══════════════════════════════════════════════════════════ */}

      <div
        className="rounded-2xl overflow-x-auto shadow-2xl print:shadow-none print:rounded-none"
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
                ['Client / Company', clientName ? toTitleCase(clientName) : null],
                ['Contact Person', clientContact ? toTitleCase(clientContact) : null],
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
              {[
                ['Event Name', eventName],
                ['Event Type', eventType ? toTitleCase(eventType) : null],
                ['City', eventCity ? toTitleCase(eventCity) : null],
                ['Date', eventDate ? new Date(eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null],
              ].filter(([, val]) => val).map(([lbl, val]) => (
                <div key={lbl as string} className="flex gap-3">
                  <span className="w-28 flex-shrink-0 text-xs" style={{ color: isClientPrint ? '#a0875a' : '#9ca3af' }}>{lbl}</span>
                  <span className="font-semibold leading-snug" style={{ color: isClientPrint ? '#2d2d2d' : '#111827' }}>{val}</span>
                </div>
              ))}
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
              <th className="text-left px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-8 pl-8 whitespace-nowrap">#</th>
              <th className="text-left px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide min-w-[160px]">Element / Item</th>
              <th className="text-left px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide min-w-[120px]">Specification</th>
              <th className="text-left px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-24 whitespace-nowrap">Dimensions</th>
              <th className="text-center px-2 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-12 whitespace-nowrap">Days</th>
              <th className="text-center px-2 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-12 whitespace-nowrap">Qty</th>
              <th className="text-right px-2 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-24 whitespace-nowrap">Rate</th>
              {/* Vendor cols — internal only */}
              {isDirector && showVendorCol && !isClientPrint && (
                <>
                  <th className="text-right px-2 py-2.5 text-amber-300 text-xs font-bold uppercase tracking-wide w-22 print:hidden whitespace-nowrap">Vend Rate</th>
                  <th className="text-right px-2 py-2.5 text-green-300 text-xs font-bold uppercase tracking-wide w-20 print:hidden whitespace-nowrap">Margin</th>
                  <th className="text-left px-2 py-2.5 text-amber-300 text-xs font-bold uppercase tracking-wide w-28 print:hidden whitespace-nowrap">Vendor</th>
                </>
              )}
              <th className="text-right px-3 py-2.5 pr-8 text-white text-xs font-bold uppercase tracking-wide w-32 whitespace-nowrap">Amount (₹)</th>
              <th className="w-6 print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const itemNum = rows.slice(0, i + 1).filter(r => r._type === 'item').length
              // In client print or locked/view-only, render clean text (no form fields)
              const readOnly = isClientPrint || lockDone || !canEdit

              if (row._type === 'section') {
                const colSpan = isDirector && showVendorCol && !isClientPrint ? 11 : 8
                return (
                  <tr key={i} style={{ background: internalBg }}>
                    <td colSpan={colSpan} className="px-8 py-2">
                      {readOnly ? (
                        <p className="text-xs font-black uppercase tracking-widest" style={{ color: gold }}>
                          {row.label || 'SECTION'}
                        </p>
                      ) : (
                        <input
                          value={row.label || ''}
                          onChange={e => updateRow(i, { label: e.target.value })}
                          placeholder="— Section Header —"
                          className="bg-transparent text-xs font-black uppercase tracking-widest w-full focus:outline-none"
                          style={{ color: gold }}
                        />
                      )}
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
              const descColor = isClientPrint ? '#1a1a1a' : '#111827'
              const specColor = isClientPrint ? '#6b5b45' : '#6b7280'
              const dimColor = isClientPrint ? '#2d2d2d' : '#374151'
              const sqftColor = isClientPrint ? '#a0875a' : '#9ca3af'

              return (
                <tr key={i} className="border-b group hover:bg-amber-50/40 transition-colors"
                  style={{ background: i % 2 === 0 ? rowEvenBg : rowOddBg, borderColor }}>
                  <td className="px-3 py-2.5 text-xs text-center pl-8" style={{ color: specColor }}>{itemNum}</td>

                  {/* Description */}
                  <td className="px-3 py-2.5 min-w-[180px]">
                    {row.is_lumpsum && <span className="text-xs text-amber-600 font-semibold mr-1">[LS]</span>}
                    {readOnly ? (
                      <p className="text-sm font-medium leading-snug whitespace-pre-wrap" style={{ color: descColor }}>
                        {row.description || '—'}
                      </p>
                    ) : (
                      <textarea value={row.description || ''} onChange={e => updateRow(i, { description: e.target.value })}
                        placeholder="Element name..." rows={2}
                        className={inputCls + ' resize-none leading-snug font-medium'} />
                    )}
                  </td>

                  {/* Specification */}
                  <td className="px-3 py-2.5 min-w-[140px]">
                    {readOnly ? (
                      <p className="text-xs leading-snug whitespace-pre-wrap" style={{ color: specColor }}>
                        {row.specs || ''}
                      </p>
                    ) : (
                      <textarea value={row.specs || ''} onChange={e => updateRow(i, { specs: e.target.value })}
                        placeholder="Spec / material..." rows={2}
                        className="bg-transparent text-xs focus:outline-none w-full resize-none leading-snug placeholder-gray-400"
                        style={{ color: specColor }} />
                    )}
                  </td>

                  {/* Dimensions */}
                  <td className="px-3 py-2.5">
                    <div className="space-y-0.5">
                      {readOnly ? (
                        <p className="text-xs" style={{ color: dimColor }}>{row.dim_str || '—'}</p>
                      ) : (
                        <input value={row.dim_str || ''} onChange={e => updateRow(i, { dim_str: e.target.value })}
                          placeholder="L×W ft"
                          className={inputCls + ' text-xs'} />
                      )}
                      {(row.area_sqft || 0) > 0 && (
                        <p className="text-xs" style={{ color: sqftColor }}>{row.area_sqft} sq.ft</p>
                      )}
                    </div>
                  </td>

                  {/* Days */}
                  <td className="px-2 py-2.5 text-center">
                    {readOnly ? (
                      <span className="text-sm" style={{ color: dimColor }}>{row.days ?? 1}</span>
                    ) : (
                      <input type="number" value={row.days ?? 1} min="0"
                        onChange={e => updateRow(i, { days: Number(e.target.value) })}
                        className="text-center text-sm focus:outline-none w-12 bg-transparent" style={{ color: dimColor }} />
                    )}
                  </td>

                  {/* Qty */}
                  <td className="px-2 py-2.5 text-center">
                    {readOnly ? (
                      <span className="text-sm" style={{ color: dimColor }}>{row.qty ?? 1}</span>
                    ) : (
                      <input type="number" value={row.qty ?? 1} min="0"
                        onChange={e => updateRow(i, { qty: Number(e.target.value) })}
                        className="text-center text-sm focus:outline-none w-12 bg-transparent" style={{ color: dimColor }} />
                    )}
                  </td>

                  {/* Rate */}
                  <td className="px-2 py-2.5 text-right">
                    {readOnly ? (
                      <span className="text-sm" style={{ color: dimColor }}>
                        {row.is_lumpsum ? `₹ ${fmt(row.lump_amount || 0)}` : (row.rate ? `₹ ${fmt(row.rate)}` : '—')}
                      </span>
                    ) : row.is_lumpsum ? (
                      <input type="number" value={row.lump_amount ?? 0} min="0"
                        onChange={e => updateRow(i, { lump_amount: Number(e.target.value) })}
                        placeholder="Fixed amt"
                        className="text-right text-sm focus:outline-none w-24 bg-amber-50 text-amber-700 font-semibold rounded px-1" />
                    ) : (
                      <input type="number" value={row.rate ?? 0} min="0"
                        onChange={e => updateRow(i, { rate: Number(e.target.value) })}
                        className="text-right text-sm focus:outline-none w-20 bg-transparent" style={{ color: dimColor }} />
                    )}
                  </td>

                  {/* Vendor columns — internal only */}
                  {isDirector && showVendorCol && !isClientPrint && (
                    <>
                      <td className="px-2 py-2.5 print:hidden">
                        {!row.is_lumpsum && (
                          <input type="number" value={row.vendor_rate ?? 0} min="0"
                            onChange={e => updateRow(i, { vendor_rate: Number(e.target.value) })}
                            disabled={lockDone}
                            className="text-right text-sm focus:outline-none w-20 bg-amber-50 text-amber-700 rounded px-1 disabled:opacity-70" />
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right print:hidden">
                        <span className={`text-xs font-semibold ${margin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {margin > 0 ? '+' : ''}{margin ? `₹${fmt(margin)}` : '—'}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 print:hidden">
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

                  {/* Amount */}
                  <td className="px-3 py-2.5 pr-8 text-right font-semibold" style={{ color: isClientPrint ? '#a0875a' : '#374151' }}>
                    {amt ? `₹ ${fmt(amt)}` : '—'}
                  </td>

                  {/* Row actions */}
                  <td className="print:hidden">
                    {canEdit && !lockDone && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
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

            {showServiceFee && (
              <div className="flex items-center justify-between py-1 border-b" style={{ borderColor }}>
                <span style={{ color: isClientPrint ? '#6b5b45' : '#6b7280' }} className="flex items-center gap-2">
                  Agency / Service Fee
                  {canEdit && !lockDone && (
                    <input type="number" value={serviceFee} min="0"
                      onChange={e => setServiceFee(Number(e.target.value))}
                      className="w-24 border border-gray-300 rounded px-1 py-0.5 text-xs text-right focus:outline-none" />
                  )}
                </span>
                <span className="font-semibold">₹ {fmt(serviceFeeAmt)}</span>
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

      {/* ── PAYMENT MILESTONES ──────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden print:hidden">
        <button onClick={() => setShowMilestones(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-800/50 transition-colors">
          <span className="text-amber-400 font-semibold text-sm flex items-center gap-2">
            Payment Schedule
            {milestonesTotal !== 100 && <span className="text-red-400 text-xs font-normal">({milestonesTotal}% — must be 100%)</span>}
            {milestonesTotal === 100 && grandTotal > 0 && <span className="text-gray-500 text-xs font-normal">· ₹{fmt(grandTotal)} in {milestones.length} milestones</span>}
          </span>
          {showMilestones ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </button>
        {showMilestones && (
          <div className="px-5 pb-4 space-y-2">
            {milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <input value={m.label} onChange={e => updateMilestone(i, { label: e.target.value })}
                  disabled={!canEdit || lockDone} placeholder="Milestone label"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-300 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50" />
                <div className="flex items-center gap-1 w-20">
                  <input type="number" value={m.percent} min="0" max="100"
                    onChange={e => updateMilestone(i, { percent: Number(e.target.value) })}
                    disabled={!canEdit || lockDone}
                    className="w-14 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-center text-amber-400 text-sm focus:outline-none disabled:opacity-50" />
                  <span className="text-gray-500 text-xs">%</span>
                </div>
                {grandTotal > 0 && (
                  <span className="text-gray-400 text-xs w-28 text-right">₹ {fmt(grandTotal * m.percent / 100)}</span>
                )}
                <input type="date" value={m.due_date} onChange={e => updateMilestone(i, { due_date: e.target.value })}
                  disabled={!canEdit || lockDone}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-400 text-xs focus:outline-none disabled:opacity-50" />
                {canEdit && !lockDone && (
                  <button onClick={() => removeMilestone(i)} className="text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
            {canEdit && !lockDone && (
              <button onClick={addMilestone} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-400 transition-colors mt-1">
                <Plus size={11} /> Add milestone
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── COMPLIANCE ──────────────────────────────────────────── */}
      {isDirector && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden print:hidden">
          <button onClick={() => setShowCompliance(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-800/50 transition-colors">
            <span className="text-gray-400 font-semibold text-sm">Compliance — GST · PAN · Bank · TDS</span>
            {showCompliance ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
          </button>
          {showCompliance && (
            <div className="px-5 pb-4 grid grid-cols-2 gap-3">
              {([
                ['gst_no', 'GST Number'], ['pan', 'PAN'], ['msme', 'MSME/Udyam'],
                ['bank_name', 'Bank Name'], ['account_no', 'Account No.'], ['ifsc', 'IFSC Code'], ['tds', 'TDS Clause'],
              ] as [keyof Compliance, string][]).map(([key, label]) => (
                <div key={key}>
                  <label className="text-gray-500 text-xs mb-1 block">{label}</label>
                  <input value={compliance[key]} onChange={e => setCompliance(prev => ({ ...prev, [key]: e.target.value }))}
                    disabled={lockDone}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-300 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
