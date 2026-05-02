import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrendingUp, IndianRupee, BarChart2, Users, Star, AlertTriangle } from 'lucide-react'

export default async function GoldminePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  // Goldmine is strictly owner-only — not even co-director
  if (!profile || profile.role !== 'director') redirect('/dashboard')

  const [
    { data: events },
    { data: payments },
    { data: vendorPayments },
    { data: elements },
    { data: expenses },
  ] = await Promise.all([
    supabase.from('events')
      .select('id, name, type, status, event_date, clients(name, type)')
      .neq('status', 'cancelled')
      .order('event_date', { ascending: false }),
    supabase.from('payments').select('event_id, amount, status'),
    supabase.from('vendor_payments').select('event_id, amount, status'),
    supabase.from('elements').select('event_id, quantity, vendor_rate, client_rate, margin, status').neq('status', 'cancelled'),
    supabase.from('expenses').select('event_id, amount, status').eq('status', 'approved'),
  ])

  const evts = (events || []) as any[]
  const pmts = payments || []
  const vpmts = vendorPayments || []
  const elems = elements || []
  const exps = expenses || []

  // --- Revenue ---
  const totalExpected = pmts.reduce((s, p) => s + p.amount, 0)
  const totalReceived = pmts.filter(p => p.status === 'received').reduce((s, p) => s + p.amount, 0)
  const totalOutstanding = totalExpected - totalReceived
  const totalVendorPaid = vpmts.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const totalVendorDue = vpmts.filter(p => p.status !== 'paid').reduce((s, p) => s + p.amount, 0)

  // --- Margin from elements ---
  const totalClientValue = elems.reduce((s, e) => s + ((e.client_rate || 0) * e.quantity), 0)
  const totalVendorCost = elems.reduce((s, e) => s + ((e.vendor_rate || 0) * e.quantity), 0)
  const totalMargin = totalClientValue - totalVendorCost
  const marginPct = totalClientValue > 0 ? ((totalMargin / totalClientValue) * 100).toFixed(1) : '0'

  // --- By Client Type ---
  const byClientType: Record<string, { label: string; events: number; revenue: number; received: number }> = {
    agency: { label: 'Agency', events: 0, revenue: 0, received: 0 },
    corporate: { label: 'Corporate', events: 0, revenue: 0, received: 0 },
    government: { label: 'Government', events: 0, revenue: 0, received: 0 },
    individual: { label: 'Individual', events: 0, revenue: 0, received: 0 },
  }
  evts.forEach(ev => {
    const type = ev.clients?.type || 'individual'
    if (!byClientType[type]) return
    byClientType[type].events++
    const evPmts = pmts.filter(p => p.event_id === ev.id)
    byClientType[type].revenue += evPmts.reduce((s, p) => s + p.amount, 0)
    byClientType[type].received += evPmts.filter(p => p.status === 'received').reduce((s, p) => s + p.amount, 0)
  })

  // --- Per Event Margin ---
  const eventMargins = evts.map(ev => {
    const evElems = elems.filter(e => e.event_id === ev.id)
    const cv = evElems.reduce((s, e) => s + ((e.client_rate || 0) * e.quantity), 0)
    const vc = evElems.reduce((s, e) => s + ((e.vendor_rate || 0) * e.quantity), 0)
    const margin = cv - vc
    const pct = cv > 0 ? ((margin / cv) * 100).toFixed(0) : '0'
    const received = pmts.filter(p => p.event_id === ev.id && p.status === 'received').reduce((s, p) => s + p.amount, 0)
    return { ...ev, cv, vc, margin, pct: Number(pct), received }
  }).filter(e => e.cv > 0).sort((a, b) => b.margin - a.margin)

  // --- Monthly Revenue (last 12 months) ---
  const monthMap: Record<string, number> = {}
  pmts.filter(p => p.status === 'received').forEach(p => {
    // payments don't have date directly, so we use events' event_date
    // For now, approximate by creation — will use event_date from evts
  })
  evts.forEach(ev => {
    if (!ev.event_date) return
    const month = ev.event_date.substring(0, 7) // YYYY-MM
    const evReceived = pmts.filter(p => p.event_id === ev.id && p.status === 'received').reduce((s, p) => s + p.amount, 0)
    monthMap[month] = (monthMap[month] || 0) + evReceived
  })
  const monthlyData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)

  // --- Active events count ---
  const activeCount = evts.filter(e => ['active', 'execution'].includes(e.status)).length
  const completedCount = evts.filter(e => e.status === 'completed').length

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
        </div>
        <p className="text-gray-500 text-sm">Business intelligence · Directors only</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
        <StatCard label="Total Revenue" value={fmt(totalReceived)} sub={`of ${fmt(totalExpected)} billed`} color="text-green-400" />
        <StatCard label="Outstanding" value={fmt(totalOutstanding)} sub={`${pmts.filter(p => p.status === 'overdue').length} overdue`} color="text-red-400" />
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

      {/* Top Events by Margin */}
      {eventMargins.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-7">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
            <TrendingUp size={16} className="text-amber-500" />
            <h2 className="text-white font-semibold text-sm">Events by Margin</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {eventMargins.slice(0, 8).map(ev => (
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

      {/* Alerts */}
      {(pmts.filter(p => p.status === 'overdue').length > 0 || vpmts.filter(p => p.status === 'overdue').length > 0) && (
        <div className="bg-red-950/30 border border-red-900/40 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-400" />
            <h2 className="text-red-400 font-semibold text-sm">Overdue Alerts</h2>
          </div>
          <div className="space-y-1.5 text-sm">
            {pmts.filter(p => p.status === 'overdue').length > 0 && (
              <p className="text-gray-300">
                <span className="text-red-400 font-semibold">{pmts.filter(p => p.status === 'overdue').length}</span> client payment{pmts.filter(p => p.status === 'overdue').length > 1 ? 's' : ''} overdue
                {' '}· <a href="/dashboard/followup" className="text-amber-500 hover:text-amber-400">View follow-up →</a>
              </p>
            )}
            {vpmts.filter(p => p.status === 'overdue').length > 0 && (
              <p className="text-gray-300">
                <span className="text-red-400 font-semibold">{vpmts.filter(p => p.status === 'overdue').length}</span> vendor payment{vpmts.filter(p => p.status === 'overdue').length > 1 ? 's' : ''} overdue
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
