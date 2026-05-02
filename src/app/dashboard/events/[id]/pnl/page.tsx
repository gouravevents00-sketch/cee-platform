import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, TrendingDown, IndianRupee, ArrowLeft } from 'lucide-react'
import VendorPaymentRow from './VendorPaymentRow'

export default async function PnLPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['director', 'accounts'].includes(profile.role)) redirect('/dashboard')

  const [
    { data: event },
    { data: payments },
    { data: vendorPayments },
    { data: elements },
    { data: expenses },
  ] = await Promise.all([
    supabase.from('events').select('id, name, status, clients(name)').eq('id', id).single(),
    supabase.from('payments').select('*').eq('event_id', id),
    supabase.from('vendor_payments').select('*, vendors(name, category)').eq('event_id', id),
    supabase.from('elements').select('*').eq('event_id', id).neq('status', 'cancelled'),
    supabase.from('expenses').select('*').eq('event_id', id).eq('status', 'approved'),
  ])

  if (!event) notFound()

  // ── Revenue ──────────────────────────────────────────────
  const clientExpected = (payments || []).reduce((s, p) => s + p.amount, 0)
  const clientReceived = (payments || []).filter(p => p.status === 'received').reduce((s, p) => s + p.amount, 0)
  const clientPending = clientExpected - clientReceived

  // ── Element-based costing ─────────────────────────────────
  const clientValue = (elements || []).reduce((s, e) => s + ((e.client_rate || 0) * e.quantity), 0)
  const vendorCost = (elements || []).reduce((s, e) => s + ((e.vendor_rate || 0) * e.quantity), 0)
  const elementMargin = clientValue - vendorCost
  const elementMarginPct = clientValue > 0 ? ((elementMargin / clientValue) * 100).toFixed(1) : '0'

  // ── Vendor payments ───────────────────────────────────────
  const vendorPaid = (vendorPayments || []).filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const vendorPending = (vendorPayments || []).filter(p => p.status !== 'paid').reduce((s, p) => s + p.amount, 0)

  // ── Expenses ──────────────────────────────────────────────
  const totalExpenses = (expenses || []).reduce((s, e) => s + e.amount, 0)

  // ── Net ──────────────────────────────────────────────────
  const totalOut = vendorPaid + totalExpenses
  const netCash = clientReceived - totalOut
  const grossMargin = clientExpected > 0 ? (((clientExpected - vendorCost) / clientExpected) * 100).toFixed(1) : '0'

  function pct(part: number, total: number) {
    if (total === 0) return '0'
    return ((part / total) * 100).toFixed(1)
  }

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back */}
      <div className="mb-5">
        <Link href={`/dashboard/events/${id}`} className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} /> {(event as any).name}
        </Link>
        <h1 className="text-white text-2xl font-bold mt-1">P&L Overview</h1>
        {(event as any).clients?.name && <p className="text-gray-500 text-sm">{(event as any).clients.name}</p>}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Revenue Expected" value={fmt(clientExpected)} sub={`${fmt(clientReceived)} received`} color="text-white" />
        <MetricCard label="Vendor Cost" value={fmt(vendorCost)} sub="from element sheet" color="text-orange-400" />
        <MetricCard
          label="Gross Margin"
          value={fmt(elementMargin)}
          sub={`${elementMarginPct}% of revenue`}
          color={elementMargin >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <MetricCard
          label="Net Cash Position"
          value={fmt(netCash)}
          sub={`${fmt(clientReceived)} in − ${fmt(totalOut)} out`}
          color={netCash >= 0 ? 'text-green-400' : 'text-red-400'}
        />
      </div>

      {/* Revenue Section */}
      <Section title="Revenue — Client Payments" icon={<IndianRupee size={14} className="text-green-400" />}>
        <Row label="Total Expected" value={fmt(clientExpected)} />
        <Row label="Received" value={fmt(clientReceived)} highlight="text-green-400" />
        <Row label="Pending / Outstanding" value={fmt(clientPending)} highlight={clientPending > 0 ? 'text-amber-400' : 'text-gray-400'} />
        <ProgressBar received={clientReceived} total={clientExpected} color="bg-green-500" />
      </Section>

      {/* Element-based Cost Section */}
      <Section title="Costing — Element Sheet" icon={<TrendingDown size={14} className="text-orange-400" />}>
        <Row label="Client Rate Total" value={fmt(clientValue)} />
        <Row label="Vendor Rate Total" value={fmt(vendorCost)} highlight="text-orange-400" />
        <Row label="Margin from Elements" value={fmt(elementMargin)} highlight={elementMargin >= 0 ? 'text-green-400' : 'text-red-400'} />
        <Row label="Margin %" value={`${elementMarginPct}%`} highlight={parseFloat(elementMarginPct) >= 20 ? 'text-green-400' : 'text-amber-400'} />
        <p className="text-gray-600 text-xs pt-2">Based on {(elements || []).length} active elements</p>
      </Section>

      {/* Vendor Payments Section */}
      <Section title="Vendor Payments" icon={<TrendingDown size={14} className="text-orange-400" />}>
        {(vendorPayments || []).length === 0 ? (
          <p className="text-gray-600 text-sm">No vendor payments recorded</p>
        ) : (
          <>
            {(vendorPayments as any[]).map(vp => (
              <VendorPaymentRow
                key={vp.id}
                paymentId={vp.id}
                vendorName={vp.vendors?.name || 'Unknown'}
                category={vp.vendors?.category}
                amount={vp.amount}
                status={vp.status}
                paidDate={vp.paid_date}
                canEdit={profile.role === 'director' || profile.role === 'accounts'}
              />
            ))}
            <div className="pt-2 border-t border-gray-800 mt-2">
              <Row label="Total Paid" value={fmt(vendorPaid)} highlight="text-green-400" />
              <Row label="Total Pending" value={fmt(vendorPending)} highlight={vendorPending > 0 ? 'text-amber-400' : 'text-gray-400'} />
            </div>
          </>
        )}
      </Section>

      {/* Expenses Section */}
      <Section title="Approved Expenses" icon={<TrendingDown size={14} className="text-red-400" />}>
        {(expenses || []).length === 0 ? (
          <p className="text-gray-600 text-sm">No approved expenses</p>
        ) : (
          <>
            {(expenses as any[]).map(ex => (
              <Row key={ex.id} label={ex.item} value={fmt(ex.amount)} badge={ex.category} />
            ))}
            <div className="pt-2 border-t border-gray-800 mt-2">
              <Row label="Total Expenses" value={fmt(totalExpenses)} highlight="text-red-400" />
            </div>
          </>
        )}
      </Section>

      {/* Net Summary */}
      <div className={`bg-gray-900 border rounded-2xl p-5 ${netCash >= 0 ? 'border-green-900/40' : 'border-red-900/40'}`}>
        <div className="flex items-center gap-2 mb-4">
          {netCash >= 0
            ? <TrendingUp size={16} className="text-green-400" />
            : <TrendingDown size={16} className="text-red-400" />}
          <h3 className="text-white font-semibold">Net Summary</h3>
        </div>
        <div className="space-y-2">
          <Row label="Cash Received from Client" value={fmt(clientReceived)} highlight="text-green-400" />
          <Row label="Vendor Payments Made" value={`− ${fmt(vendorPaid)}`} highlight="text-orange-400" />
          <Row label="Expenses Paid" value={`− ${fmt(totalExpenses)}`} highlight="text-red-400" />
          <div className="pt-3 border-t border-gray-800">
            <Row
              label="Net Cash Position"
              value={fmt(netCash)}
              highlight={netCash >= 0 ? 'text-green-400 font-bold text-base' : 'text-red-400 font-bold text-base'}
            />
            <Row
              label="Overall Gross Margin %"
              value={`${grossMargin}%`}
              highlight={parseFloat(grossMargin) >= 20 ? 'text-green-400' : 'text-amber-400'}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p className={`font-bold text-lg ${color}`}>{value}</p>
      <p className="text-gray-600 text-xs mt-0.5">{sub}</p>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-white font-semibold text-sm">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({ label, value, highlight, badge }: { label: string; value: string; highlight?: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-400 text-sm flex items-center gap-2">
        {label}
        {badge && <span className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded capitalize">{badge}</span>}
      </span>
      <span className={`text-sm font-medium ${highlight || 'text-white'}`}>{value}</span>
    </div>
  )
}

function ProgressBar({ received, total, color }: { received: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min((received / total) * 100, 100) : 0
  return (
    <div className="mt-3 pt-3 border-t border-gray-800">
      <div className="flex justify-between text-xs text-gray-600 mb-1.5">
        <span>Collection progress</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
