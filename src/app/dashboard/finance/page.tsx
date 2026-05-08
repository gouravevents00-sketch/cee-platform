import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle, Clock, CheckCircle2, FileText,
  TrendingUp, IndianRupee, AlertTriangle, ArrowRight,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────
function fmt(n: number) { return `₹${Math.round(n).toLocaleString('en-IN')}` }
function fmtShort(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}
function daysSince(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}
function daysUntil(d: string) {
  return Math.floor((new Date(d).getTime() - Date.now()) / 86400000)
}

type FinanceStatus = 'overdue' | 'due_soon' | 'partial' | 'no_invoice' | 'draft' | 'paid' | 'no_quotation'

interface EventFinance {
  id: string
  name: string
  eventDate: string | null
  status: string
  clientName: string
  clientType: string
  creditPeriodDays: number
  invoiceId: string | null
  invoiceNumber: string | null
  invoiceStatus: string | null
  invoiceTotal: number
  received: number
  outstanding: number
  nearestDueDate: string | null
  overdueDays: number
  vendorPending: number
  vendorPaid: number
  hasLockedQuotation: boolean
  financeStatus: FinanceStatus
}

// ── Status config ─────────────────────────────────────────────────
const STATUS_CFG: Record<FinanceStatus, { label: string; dot: string; row: string; priority: number }> = {
  overdue:      { label: 'Overdue',      dot: 'bg-red-500',    row: 'border-red-900/40 bg-red-950/10',    priority: 1 },
  due_soon:     { label: 'Due Soon',     dot: 'bg-amber-400',  row: 'border-amber-900/30 bg-amber-950/5', priority: 2 },
  partial:      { label: 'Partial',      dot: 'bg-blue-400',   row: 'border-gray-800',                     priority: 3 },
  no_invoice:   { label: 'No Invoice',   dot: 'bg-orange-400', row: 'border-orange-900/30',                priority: 4 },
  draft:        { label: 'Draft',        dot: 'bg-gray-500',   row: 'border-gray-800',                     priority: 5 },
  paid:         { label: 'Paid',         dot: 'bg-green-500',  row: 'border-green-900/20',                 priority: 6 },
  no_quotation: { label: 'No Quotation', dot: 'bg-gray-700',   row: 'border-gray-800/50 opacity-60',       priority: 7 },
}

export default async function FinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['director', 'accounts', 'admin'].includes(profile.role)) redirect('/dashboard')

  // ── Fetch all active/completed events ──────────────────────────
  const { data: rawEvents } = await supabase
    .from('events')
    .select('id, name, status, event_date, clients(name, type, credit_period_days, advance_percent)')
    .in('status', ['enquiry', 'active', 'completed'])
    .order('event_date', { ascending: true, nullsFirst: false })

  if (!rawEvents?.length) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="text-white text-2xl font-bold mb-2">Finance Overview</h1>
        <p className="text-gray-500">No active events found.</p>
      </div>
    )
  }

  const eventIds = rawEvents.map(e => e.id)

  // ── Batch fetch all financial data ─────────────────────────────
  const [
    { data: invoices },
    { data: receipts },
    { data: payments },
    { data: vendorPayments },
    { data: quotations },
  ] = await Promise.all([
    supabase.from('client_invoices')
      .select('id, event_id, total, status, invoice_number, created_at')
      .in('event_id', eventIds),
    supabase.from('client_receipts')
      .select('id, event_id, amount')
      .in('event_id', eventIds),
    supabase.from('payments')
      .select('id, event_id, amount, status, due_date, label')
      .in('event_id', eventIds),
    supabase.from('vendor_payments')
      .select('id, event_id, amount, status')
      .in('event_id', eventIds),
    supabase.from('quotations')
      .select('id, event_id, locked_at, total')
      .in('event_id', eventIds)
      .not('locked_at', 'is', null),
  ])

  // ── Build maps ─────────────────────────────────────────────────
  const invoiceByEvent = new Map<string, any>()
  ;(invoices || []).forEach(inv => {
    const existing = invoiceByEvent.get(inv.event_id)
    if (!existing || new Date(inv.created_at) > new Date(existing.created_at)) {
      invoiceByEvent.set(inv.event_id, inv)
    }
  })

  const receiptsByEvent = new Map<string, number>()
  ;(receipts || []).forEach(r => {
    receiptsByEvent.set(r.event_id, (receiptsByEvent.get(r.event_id) || 0) + r.amount)
  })

  const paymentsByEvent = new Map<string, any[]>()
  ;(payments || []).forEach(p => {
    const arr = paymentsByEvent.get(p.event_id) || []
    arr.push(p)
    paymentsByEvent.set(p.event_id, arr)
  })

  const vendorByEvent = new Map<string, { paid: number; pending: number }>()
  ;(vendorPayments || []).forEach(vp => {
    const cur = vendorByEvent.get(vp.event_id) || { paid: 0, pending: 0 }
    if (vp.status === 'paid') cur.paid += vp.amount
    else cur.pending += vp.amount
    vendorByEvent.set(vp.event_id, cur)
  })

  const lockedQuotationEvents = new Set((quotations || []).map(q => q.event_id))

  // ── Compute per-event finance status ───────────────────────────
  const today = new Date()
  const events: EventFinance[] = rawEvents.map((ev: any) => {
    const client = ev.clients || {}
    const invoice = invoiceByEvent.get(ev.id)
    const received = receiptsByEvent.get(ev.id) || 0
    const milestones = paymentsByEvent.get(ev.id) || []
    const vendor = vendorByEvent.get(ev.id) || { paid: 0, pending: 0 }
    const hasLockedQuotation = lockedQuotationEvents.has(ev.id)

    const invoiceTotal = invoice?.total || 0
    // Fallback: sum milestone amounts if no invoice
    const milestonesTotal = milestones.reduce((s: number, p: any) => s + p.amount, 0)
    const milestonesReceived = milestones
      .filter((p: any) => p.status === 'received')
      .reduce((s: number, p: any) => s + p.amount, 0)

    const effectiveTotal = invoiceTotal > 0 ? invoiceTotal : milestonesTotal
    const effectiveReceived = received > 0 ? received : milestonesReceived
    const outstanding = Math.max(0, effectiveTotal - effectiveReceived)

    // Find nearest upcoming/overdue due date
    const pendingMilestones = milestones.filter((p: any) => p.status !== 'received' && p.due_date)
    const sortedDues = pendingMilestones.sort((a: any, b: any) =>
      new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    )
    const nearestDue = sortedDues[0]?.due_date || null
    const overdueDays = nearestDue && new Date(nearestDue) < today
      ? daysSince(nearestDue) : 0

    // Determine finance status
    let financeStatus: FinanceStatus = 'no_quotation'
    if (hasLockedQuotation) {
      if (!invoice) {
        financeStatus = 'no_invoice'
      } else if (invoice.status === 'paid' || outstanding === 0) {
        financeStatus = 'paid'
      } else if (overdueDays > 0) {
        financeStatus = 'overdue'
      } else if (nearestDue && daysUntil(nearestDue) <= 7) {
        financeStatus = 'due_soon'
      } else if (effectiveReceived > 0 && outstanding > 0) {
        financeStatus = 'partial'
      } else if (invoice.status === 'draft') {
        financeStatus = 'draft'
      } else {
        financeStatus = 'partial'
      }
    }

    return {
      id: ev.id,
      name: ev.name,
      eventDate: ev.event_date,
      status: ev.status,
      clientName: client.name || '—',
      clientType: client.type || 'corporate',
      creditPeriodDays: client.credit_period_days || 30,
      invoiceId: invoice?.id || null,
      invoiceNumber: invoice?.invoice_number || null,
      invoiceStatus: invoice?.status || null,
      invoiceTotal: effectiveTotal,
      received: effectiveReceived,
      outstanding,
      nearestDueDate: nearestDue,
      overdueDays,
      vendorPending: vendor.pending,
      vendorPaid: vendor.paid,
      hasLockedQuotation,
      financeStatus,
    }
  })

  // Sort by priority
  events.sort((a, b) => STATUS_CFG[a.financeStatus].priority - STATUS_CFG[b.financeStatus].priority)

  // ── Aggregate KPIs ─────────────────────────────────────────────
  const totalAR = events.reduce((s, e) => s + e.outstanding, 0)
  const totalOverdue = events.filter(e => e.financeStatus === 'overdue').reduce((s, e) => s + e.outstanding, 0)
  const overdueCount = events.filter(e => e.financeStatus === 'overdue').length
  const needsInvoice = events.filter(e => e.financeStatus === 'no_invoice').length
  const vendorReleasePending = events.reduce((s, e) => s + e.vendorPending, 0)
  const totalReceived = events.reduce((s, e) => s + e.received, 0)
  const totalBilled = events.reduce((s, e) => s + e.invoiceTotal, 0)
  const collectionPct = totalBilled > 0 ? Math.round((totalReceived / totalBilled) * 100) : 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-white text-2xl font-bold">Finance Overview</h1>
        <p className="text-gray-500 text-sm mt-0.5">Client collections · Vendor settlements · Outstanding dues</p>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total Outstanding (AR)"
          value={fmtShort(totalAR)}
          sub={`${collectionPct}% collected of ₹${fmtShort(totalBilled)}`}
          icon={<IndianRupee size={16} className="text-amber-400" />}
          urgent={totalAR > 0}
        />
        <KpiCard
          label="Overdue"
          value={fmtShort(totalOverdue)}
          sub={`${overdueCount} event${overdueCount !== 1 ? 's' : ''} past due`}
          icon={<AlertCircle size={16} className="text-red-400" />}
          urgent={totalOverdue > 0}
        />
        <KpiCard
          label="Vendor Settlements"
          value={fmtShort(vendorReleasePending)}
          sub="pending release"
          icon={<Clock size={16} className="text-blue-400" />}
          urgent={false}
        />
        <KpiCard
          label="Invoices Needed"
          value={String(needsInvoice)}
          sub="locked events without invoice"
          icon={<FileText size={16} className="text-orange-400" />}
          urgent={needsInvoice > 0}
        />
      </div>

      {/* ── Events Table ───────────────────────────────────────── */}
      <div className="space-y-2">
        {events.map(ev => {
          const sc = STATUS_CFG[ev.financeStatus]
          const collPct = ev.invoiceTotal > 0
            ? Math.round((ev.received / ev.invoiceTotal) * 100) : 0

          return (
            <div
              key={ev.id}
              className={`border rounded-2xl px-5 py-4 ${sc.row}`}
            >
              <div className="flex items-start gap-3">
                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${sc.dot}`} />

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* Left: event info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold text-sm truncate">{ev.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ev.financeStatus === 'overdue' ? 'bg-red-900/60 text-red-400' :
                          ev.financeStatus === 'due_soon' ? 'bg-amber-900/60 text-amber-400' :
                          ev.financeStatus === 'paid' ? 'bg-green-900/60 text-green-400' :
                          ev.financeStatus === 'no_invoice' ? 'bg-orange-900/60 text-orange-400' :
                          'bg-gray-800 text-gray-400'
                        }`}>
                          {sc.label}
                          {ev.overdueDays > 0 && ` · ${ev.overdueDays}d`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span>{ev.clientName}</span>
                        {ev.clientType && (
                          <span className="capitalize">{ev.clientType}</span>
                        )}
                        {ev.eventDate && (
                          <span>
                            {new Date(ev.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {ev.invoiceNumber && (
                          <span className="text-gray-600">{ev.invoiceNumber}</span>
                        )}
                      </div>
                    </div>

                    {/* Right: amounts */}
                    <div className="flex items-center gap-6 flex-shrink-0 text-right">
                      {ev.invoiceTotal > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">Billed</p>
                          <p className="text-white text-sm font-semibold">{fmt(ev.invoiceTotal)}</p>
                        </div>
                      )}
                      {ev.received > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">Received</p>
                          <p className="text-green-400 text-sm font-semibold">{fmt(ev.received)}</p>
                        </div>
                      )}
                      {ev.outstanding > 0 && (
                        <div>
                          <p className="text-xs text-gray-500">Outstanding</p>
                          <p className={`text-sm font-bold ${ev.overdueDays > 0 ? 'text-red-400' : 'text-amber-400'}`}>
                            {fmt(ev.outstanding)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar (if any billing) */}
                  {ev.invoiceTotal > 0 && collPct < 100 && (
                    <div className="mt-2.5 h-1 bg-gray-800 rounded-full overflow-hidden w-full max-w-xs">
                      <div
                        className={`h-full rounded-full ${ev.overdueDays > 0 ? 'bg-red-500' : 'bg-amber-500'}`}
                        style={{ width: `${collPct}%` }}
                      />
                    </div>
                  )}

                  {/* Vendor pending + actions */}
                  <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    {ev.vendorPending > 0 && (
                      <span className="text-xs text-blue-400 bg-blue-950/30 border border-blue-900/30 px-2 py-0.5 rounded-lg">
                        Vendor: {fmt(ev.vendorPending)} pending release
                      </span>
                    )}
                    {ev.nearestDueDate && ev.overdueDays === 0 && daysUntil(ev.nearestDueDate) <= 7 && (
                      <span className="text-xs text-amber-400">
                        Due {daysUntil(ev.nearestDueDate) === 0 ? 'today' : `in ${daysUntil(ev.nearestDueDate)} days`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                  {ev.financeStatus === 'no_invoice' && (
                    <Link href={`/dashboard/events/${ev.id}/invoice`}
                      className="text-xs bg-orange-500 hover:bg-orange-400 text-black font-semibold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1">
                      Create Invoice <ArrowRight size={11} />
                    </Link>
                  )}
                  {ev.financeStatus === 'no_quotation' && (
                    <Link href={`/dashboard/events/${ev.id}/quotation`}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1.5 rounded-xl transition-colors">
                      Add Quotation
                    </Link>
                  )}
                  {['overdue', 'due_soon', 'partial', 'draft'].includes(ev.financeStatus) && (
                    <Link href={`/dashboard/events/${ev.id}/invoice`}
                      className="text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1">
                      Invoice <ArrowRight size={11} />
                    </Link>
                  )}
                  <Link href={`/dashboard/events/${ev.id}/payments`}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1.5 rounded-xl transition-colors">
                    Payments
                  </Link>
                  <Link href={`/dashboard/events/${ev.id}/pnl`}
                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-1">
                    P&amp;L
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Alerts section ─────────────────────────────────────── */}
      {(overdueCount > 0 || needsInvoice > 0) && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest">Action Required</p>
          {overdueCount > 0 && (
            <div className="flex items-center gap-3">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">
                <span className="font-semibold">{overdueCount} event{overdueCount > 1 ? 's' : ''}</span> have overdue payments.
                Send reminders from the Invoice page.
              </p>
            </div>
          )}
          {needsInvoice > 0 && (
            <div className="flex items-center gap-3">
              <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
              <p className="text-sm text-orange-300">
                <span className="font-semibold">{needsInvoice} event{needsInvoice > 1 ? 's' : ''}</span> have locked quotations but no invoice raised.
              </p>
            </div>
          )}
          {vendorReleasePending > 0 && (
            <div className="flex items-center gap-3">
              <TrendingUp size={14} className="text-blue-400 flex-shrink-0" />
              <p className="text-sm text-blue-300">
                <span className="font-semibold">{fmt(vendorReleasePending)}</span> vendor payments are pending.
                Director approval needed to release.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Collection summary ─────────────────────────────────── */}
      {totalBilled > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-4">Collection Summary</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Total Billed</p>
              <p className="text-white font-bold text-lg">{fmt(totalBilled)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Collected</p>
              <p className="text-green-400 font-bold text-lg">{fmt(totalReceived)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Outstanding</p>
              <p className="text-amber-400 font-bold text-lg">{fmt(totalAR)}</p>
            </div>
          </div>
          <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${collectionPct}%` }} />
          </div>
          <p className="text-gray-600 text-xs mt-1.5">{collectionPct}% collected across all active events</p>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, urgent }: {
  label: string; value: string; sub: string; icon: React.ReactNode; urgent: boolean
}) {
  return (
    <div className={`rounded-2xl border p-4 ${urgent ? 'bg-gray-900 border-gray-700' : 'bg-gray-900 border-gray-800'}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-gray-500 text-xs">{label}</p>
      </div>
      <p className="text-white text-2xl font-bold">{value}</p>
      <p className="text-gray-600 text-xs mt-0.5">{sub}</p>
    </div>
  )
}
