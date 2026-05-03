import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrendingUp, IndianRupee, BarChart2, Users, Star, AlertTriangle, Shield, Package } from 'lucide-react'

export default async function GoldminePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  // Goldmine requires goldmine_access flag — founding director (Gourav) only
  if (!profile || !profile.goldmine_access) redirect('/dashboard')

  const [
    { data: events },
    { data: payments },
    { data: vendorPayments },
    { data: elements },
    { data: expenses },
    { data: vendors },
    { data: invoices },
    { data: receipts },
  ] = await Promise.all([
    supabase.from('events')
      .select('id, name, type, status, event_date, clients(name, type)')
      .neq('status', 'cancelled')
      .order('event_date', { ascending: false }),
    supabase.from('payments').select('event_id, amount, status, due_date, label, type'),
    supabase.from('vendor_payments').select('event_id, amount, status'),
    supabase.from('elements').select('event_id, quantity, vendor_rate, client_rate, margin, status').neq('status', 'cancelled'),
    supabase.from('expenses').select('event_id, amount, status').eq('status', 'approved'),
    supabase.from('vendors').select('id, name, category, total_events, on_time_count, quality_rating, last_event_date, notes_internal').order('name'),
    supabase.from('client_invoices').select('event_id, total, status, invoice_number').neq('status', 'draft'),
    supabase.from('client_receipts').select('event_id, amount, receipt_date'),
  ])

  const evts = (events || []) as any[]
  const pmts = (payments || []) as any[]
  const vpmts = (vendorPayments || []) as any[]
  const elems = (elements || []) as any[]
  const exps = (expenses || []) as any[]
  const vends = (vendors || []) as any[]
  const invs = (invoices || []) as any[]
  const recs = (receipts || []) as any[]

  // --- Revenue (invoice-based where available, milestone-based fallback) ---
  const totalExpected = (() => {
    const invoicedEventIds = new Set(invs.map((i: any) => i.event_id))
    const invoiceTotal = invs.reduce((s: number, i: any) => s + (i.total || 0), 0)
    const milestoneTotal = pmts
      .filter((p: any) => !invoicedEventIds.has(p.event_id))
      .reduce((s: number, p: any) => s + p.amount, 0)
    return invoiceTotal + milestoneTotal
  })()

  const totalReceived = (() => {
    const receiptEventIds = new Set(recs.map((r: any) => r.event_id))
    const receiptTotal = recs.reduce((s: number, r: any) => s + (r.amount || 0), 0)
    const milestoneReceived = pmts
      .filter((p: any) => !receiptEventIds.has(p.event_id) && p.status === 'received')
      .reduce((s: number, p: any) => s + p.amount, 0)
    return receiptTotal + milestoneReceived
  })()

  const totalOutstanding = totalExpected - totalReceived
  const totalVendorPaid = vpmts.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + p.amount, 0)
  const totalVendorDue = vpmts.filter((p: any) => p.status !== 'paid').reduce((s: number, p: any) => s + p.amount, 0)

  // --- Margin from elements ---
  const totalClientValue = elems.reduce((s: number, e: any) => s + ((e.client_rate || 0) * e.quantity), 0)
  const totalVendorCost = elems.reduce((s: number, e: any) => s + ((e.vendor_rate || 0) * e.quantity), 0)
  const totalMargin = totalClientValue - totalVendorCost
  const marginPct = totalClientValue > 0 ? ((totalMargin / totalClientValue) * 100).toFixed(1) : '0'

  // --- By Client Type ---
  const byClientType: Record<string, { label: string; events: number; revenue: number; received: number }> = {
    agency: { label: 'Agency', events: 0, revenue: 0, received: 0 },
    corporate: { label: 'Corporate', events: 0, revenue: 0, received: 0 },
    government: { label: 'Government', events: 0, revenue: 0, received: 0 },
    individual: { label: 'Individual', events: 0, revenue: 0, received: 0 },
  }
  evts.forEach((ev: any) => {
    const type = ev.clients?.type || 'individual'
    if (!byClientType[type]) return
    byClientType[type].events++
    const evPmts = pmts.filter((p: any) => p.event_id === ev.id)
    byClientType[type].revenue += evPmts.reduce((s: number, p: any) => s + p.amount, 0)
    byClientType[type].received += evPmts.filter((p: any) => p.status === 'received').reduce((s: number, p: any) => s + p.amount, 0)
  })

  // --- Per Event Margin ---
  const eventMargins = evts.map((ev: any) => {
    const evElems = elems.filter((e: any) => e.event_id === ev.id)
    const cv = evElems.reduce((s: number, e: any) => s + ((e.client_rate || 0) * e.quantity), 0)
    const vc = evElems.reduce((s: number, e: any) => s + ((e.vendor_rate || 0) * e.quantity), 0)
    const margin = cv - vc
    const pct = cv > 0 ? ((margin / cv) * 100).toFixed(0) : '0'
    const received = pmts.filter((p: any) => p.event_id === ev.id && p.status === 'received').reduce((s: number, p: any) => s + p.amount, 0)
    return { ...ev, cv, vc, margin, pct: Number(pct), received }
  }).filter((e: any) => e.cv > 0).sort((a: any, b: any) => b.margin - a.margin)

  // --- Monthly Revenue ---
  const monthMap: Record<string, number> = {}
  evts.forEach((ev: any) => {
    if (!ev.event_date) return
    const month = ev.event_date.substring(0, 7)
    const evReceipts = recs.filter((r: any) => r.event_id === ev.id).reduce((s: number, r: any) => s + r.amount, 0)
    const evMilestoneReceived = evReceipts === 0
      ? pmts.filter((p: any) => p.event_id === ev.id && p.status === 'received').reduce((s: number, p: any) => s + p.amount, 0)
      : 0
    const evTotal = evReceipts + evMilestoneReceived
    if (evTotal > 0) monthMap[month] = (monthMap[month] || 0) + evTotal
  })
  const monthlyData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)

  // --- Collections Pipeline (active/execution events with pending amounts) ---
  const today = new Date()
  const collectionsData = evts
    .filter((ev: any) => ['active', 'execution', 'completed'].includes(ev.status))
    .map((ev: any) => {
      const evInvoice = invs.find((i: any) => i.event_id === ev.id)
      const evReceiptTotal = recs.filter((r: any) => r.event_id === ev.id).reduce((s: number, r: any) => s + r.amount, 0)
      const evMilestoneTotal = pmts.filter((p: any) => p.event_id === ev.id).reduce((s: number, p: any) => s + p.amount, 0)
      const evMilestoneReceived = pmts.filter((p: any) => p.event_id === ev.id && p.status === 'received').reduce((s: number, p: any) => s + p.amount, 0)

      const expected = evInvoice ? evInvoice.total : evMilestoneTotal
      const received = evReceiptTotal > 0 ? evReceiptTotal : evMilestoneReceived
      const pending = expected - received

      // Days overdue: find oldest overdue/pending milestone
      const overduePmts = pmts.filter((p: any) =>
        p.event_id === ev.id &&
        p.status !== 'received' &&
        p.due_date &&
        new Date(p.due_date) < today
      )
      const daysOverdue = overduePmts.length > 0
        ? Math.max(...overduePmts.map((p: any) => Math.floor((today.getTime() - new Date(p.due_date).getTime()) / 86400000)))
        : 0

      return { ...ev, expected, received, pending, daysOverdue }
    })
    .filter((ev: any) => ev.pending > 0)
    .sort((a: any, b: any) => b.daysOverdue - a.daysOverdue || b.pending - a.pending)

  // --- Vendor Reliability ---
  const vendorWithScore = vends
    .filter((v: any) => (v.total_events || 0) > 0)
    .map((v: any) => {
      const onTimePct = v.total_events > 0 ? Math.round((v.on_time_count / v.total_events) * 100) : 0
      return { ...v, onTimePct }
    })
    .sort((a: any, b: any) => b.onTimePct - a.onTimePct || b.quality_rating - a.quality_rating)

  // --- Active events count ---
  const activeCount = evts.filter((e: any) => ['active', 'execution'].includes(e.status)).length
  const completedCount = evts.filter((e: any) => e.status === 'completed').length

  function fmt(n: number) {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`
    return `₹${n.toLocaleString('en-IN')}`
  }

  const clientTypeColors: Record<string, string> = {
    agency: 'text-blue-400',
    corporate: 'text-purple-400',
    government: 'text-amber-400',
    individual: 'text-gray-400',
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-1">
          <Star size={20} className="text-amber-500" />
          <h1 className="text-white text-2xl font-bold">Goldmine Insights</h1>
          <span className="text-xs bg-amber-900/40 text-amber-400 border border-amber-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Shield size={10} /> Director Only
          </span>
        </div>
        <p className="text-gray-500 text-sm">Business intelligence · Real-time data</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
        <StatCard label="Total Revenue" value={fmt(totalReceived)} sub={`of ${fmt(totalExpected)} billed`} color="text-green-400" />
        <StatCard label="Outstanding" value={fmt(totalOutstanding)} sub={`${pmts.filter((p: any) => p.status === 'overdue').length} overdue`} color="text-red-400" />
        <StatCard label="Overall Margin" value={`${marginPct}%`} sub={fmt(totalMargin)} color="text-amber-400" />
        <StatCard label="Vendor Dues" value={fmt(totalVendorDue)} sub={`${fmt(totalVendorPaid)} paid`} color="text-orange-400" />
      </div>

      {/* Events Summary */}
      <div className="grid grid-cols-3 gap-3 mb-7">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
          <p className="text-white text-2xl font-bold">{evts.length}</p>
          <p className="text-gray-500 text-xs mt-1">Total Events</p>
        </div>
        <div className="bg-gray-900 border border-blue-900/30 rounded-2xl p-4 text-center">
          <p className="text-blue-400 text-2xl font-bold">{activeCount}</p>
          <p className="text-gray-500 text-xs mt-1">Active / Execution</p>
        </div>
        <div className="bg-gray-900 border border-green-900/30 rounded-2xl p-4 text-center">
          <p className="text-green-400 text-2xl font-bold">{completedCount}</p>
          <p className="text-gray-500 text-xs mt-1">Completed</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-7">
        {/* By Client Type */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-amber-500" />
            <h2 className="text-white font-semibold text-sm">Revenue by Client Type</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(byClientType).filter(([, d]) => d.events > 0).map(([type, d]) => {
              const pct = d.revenue > 0 ? Math.round((d.received / d.revenue) * 100) : 0
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${clientTypeColors[type]}`}>{d.label}</span>
                    <span className="text-gray-400 text-xs">{d.events} events · {fmt(d.received)} received</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-gray-600 text-xs mt-0.5">{pct}% collected of {fmt(d.revenue)}</p>
                </div>
              )
            })}
            {Object.values(byClientType).every(d => d.events === 0) && (
              <p className="text-gray-600 text-sm">No events with linked clients yet</p>
            )}
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} className="text-amber-500" />
            <h2 className="text-white font-semibold text-sm">Revenue by Month</h2>
          </div>
          {monthlyData.length === 0 ? (
            <p className="text-gray-600 text-sm">No data yet — mark payments as received to see trends</p>
          ) : (
            <div className="space-y-2">
              {(() => {
                const max = Math.max(...monthlyData.map(([, v]) => v))
                return monthlyData.map(([month, amount]) => {
                  const barPct = max > 0 ? Math.round((amount / max) * 100) : 0
                  const [yr, mo] = month.split('-')
                  const label = new Date(Number(yr), Number(mo) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
                  return (
                    <div key={month} className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs w-12 flex-shrink-0">{label}</span>
                      <div className="flex-1 h-5 bg-gray-800 rounded-lg overflow-hidden">
                        <div className="h-full bg-amber-500/70 rounded-lg flex items-center px-2 transition-all" style={{ width: `${barPct}%` }}>
                          {barPct > 30 && <span className="text-black text-[10px] font-semibold">{fmt(amount)}</span>}
                        </div>
                      </div>
                      {barPct <= 30 && <span className="text-gray-400 text-xs">{fmt(amount)}</span>}
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Collections Pipeline */}
      {collectionsData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-7">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
            <IndianRupee size={16} className="text-amber-500" />
            <h2 className="text-white font-semibold text-sm">Collections Pipeline</h2>
            <span className="text-xs text-gray-500 ml-auto">Pending amounts across active events</span>
          </div>
          <div className="divide-y divide-gray-800">
            {collectionsData.slice(0, 10).map((ev: any) => {
              const collectedPct = ev.expected > 0 ? Math.round((ev.received / ev.expected) * 100) : 0
              return (
                <div key={ev.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-800/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <a href={`/dashboard/events/${ev.id}`} className="text-white text-sm font-medium hover:text-amber-400 transition-colors block truncate">{ev.name}</a>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-gray-500 text-xs">
                        {ev.clients?.name || 'No client'}
                        {ev.event_date ? ` · ${new Date(ev.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                      </p>
                      {ev.daysOverdue > 0 && (
                        <span className="text-xs bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded-full">{ev.daysOverdue}d overdue</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${collectedPct}%` }} />
                      </div>
                      <span className="text-gray-600 text-[10px] flex-shrink-0">{collectedPct}%</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-red-400 text-sm font-semibold">{fmt(ev.pending)}</p>
                    <p className="text-gray-600 text-xs">pending of {fmt(ev.expected)}</p>
                  </div>
                </div>
              )
            })}
          </div>
          {collectionsData.length > 10 && (
            <div className="px-5 py-3 border-t border-gray-800">
              <p className="text-gray-600 text-xs">+{collectionsData.length - 10} more events with pending payments</p>
            </div>
          )}
        </div>
      )}

      {/* Top Events by Margin */}
      {eventMargins.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-7">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
            <TrendingUp size={16} className="text-amber-500" />
            <h2 className="text-white font-semibold text-sm">Events by Margin</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {eventMargins.slice(0, 8).map((ev: any) => (
              <div key={ev.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-800/30 transition-colors">
                <div>
                  <a href={`/dashboard/events/${ev.id}`} className="text-white text-sm font-medium hover:text-amber-400 transition-colors">{ev.name}</a>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {ev.clients?.name ? `${ev.clients.name} · ` : ''}
                    {ev.event_date ? new Date(ev.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${ev.pct >= 30 ? 'text-green-400' : ev.pct >= 15 ? 'text-amber-400' : 'text-red-400'}`}>
                    {ev.pct}% margin
                  </p>
                  <p className="text-gray-500 text-xs">{fmt(ev.margin)} on {fmt(ev.cv)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vendor Reliability */}
      {vendorWithScore.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-7">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
            <Package size={16} className="text-amber-500" />
            <h2 className="text-white font-semibold text-sm">Vendor Reliability</h2>
            <span className="text-xs text-gray-500 ml-auto">on-time % · quality rating</span>
          </div>
          <div className="divide-y divide-gray-800">
            {vendorWithScore.slice(0, 10).map((v: any) => (
              <div key={v.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-800/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{v.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {v.category || 'Uncategorized'} · {v.total_events} event{v.total_events !== 1 ? 's' : ''}
                    {v.last_event_date ? ` · last: ${new Date(v.last_event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                  </p>
                  {v.notes_internal && (
                    <p className="text-amber-600 text-xs mt-0.5 italic">{v.notes_internal}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-center">
                    <p className={`text-sm font-bold ${v.onTimePct >= 80 ? 'text-green-400' : v.onTimePct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      {v.onTimePct}%
                    </p>
                    <p className="text-gray-600 text-[10px]">on-time</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-bold ${v.quality_rating >= 4 ? 'text-green-400' : v.quality_rating >= 3 ? 'text-amber-400' : 'text-red-400'}`}>
                      {Number(v.quality_rating).toFixed(1)}★
                    </p>
                    <p className="text-gray-600 text-[10px]">quality</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {(pmts.filter((p: any) => p.status === 'overdue').length > 0 || vpmts.filter((p: any) => p.status === 'overdue').length > 0) && (
        <div className="bg-red-950/30 border border-red-900/40 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-400" />
            <h2 className="text-red-400 font-semibold text-sm">Overdue Alerts</h2>
          </div>
          <div className="space-y-1.5 text-sm">
            {pmts.filter((p: any) => p.status === 'overdue').length > 0 && (
              <p className="text-gray-300">
                <span className="text-red-400 font-semibold">{pmts.filter((p: any) => p.status === 'overdue').length}</span> client payment{pmts.filter((p: any) => p.status === 'overdue').length > 1 ? 's' : ''} overdue
                {' '}· <a href="/dashboard/followup" className="text-amber-500 hover:text-amber-400">View follow-up →</a>
              </p>
            )}
            {vpmts.filter((p: any) => p.status === 'overdue').length > 0 && (
              <p className="text-gray-300">
                <span className="text-red-400 font-semibold">{vpmts.filter((p: any) => p.status === 'overdue').length}</span> vendor payment{vpmts.filter((p: any) => p.status === 'overdue').length > 1 ? 's' : ''} overdue
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <p className="text-gray-500 text-xs mb-2 uppercase tracking-wide font-medium">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-gray-600 text-xs mt-0.5">{sub}</p>
    </div>
  )
}
