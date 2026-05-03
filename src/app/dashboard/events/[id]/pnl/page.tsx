import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, TrendingDown, IndianRupee, ArrowLeft, FileText, Lightbulb } from 'lucide-react'
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
    { data: invoice },
    { data: receipts },
    { data: vendorSOs },
  ] = await Promise.all([
    supabase.from('events').select('id, name, status, clients(name)').eq('id', id).single(),
    supabase.from('payments').select('*').eq('event_id', id).order('created_at'),
    supabase.from('vendor_payments').select('*, vendors(name, category)').eq('event_id', id),
    supabase.from('elements').select('*').eq('event_id', id).neq('status', 'cancelled'),
    supabase.from('expenses').select('*').eq('event_id', id).eq('status', 'approved'),
    supabase.from('client_invoices').select('id, total, subtotal, gst_amount, gst_mode, status, invoice_number')
      .eq('event_id', id).order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('client_receipts').select('id, amount, receipt_date, payment_mode, receipt_number')
      .eq('event_id', id).order('receipt_date'),
    supabase.from('vendor_purchase_orders').select('id, vendor_id, subtotal, status, vendors(name)')
      .eq('event_id', id),
  ])

  if (!event) notFound()

  // ── Revenue (from invoices + receipts, fallback to milestones) ─
  const invoiceTotal = invoice?.total || 0
  const receiptTotal = (receipts || []).reduce((s, r) => s + r.amount, 0)
  // Milestone-based fallback (when no invoice yet)
  const milestonesExpected = (payments || []).reduce((s, p) => s + p.amount, 0)
  const milestonesReceived = (payments || []).filter(p => p.status === 'received').reduce((s, p) => s + p.amount, 0)
  // Use invoice if locked, otherwise milestones
  const effectiveExpected = invoiceTotal > 0 ? invoiceTotal : milestonesExpected
  const effectiveReceived = receiptTotal > 0 ? receiptTotal : milestonesReceived
  const clientPending = effectiveExpected - effectiveReceived

  // ── Element-based costing ──────────────────────────────────────
  const clientValue = (elements || []).reduce((s, e) => s + ((e.client_rate || 0) * e.quantity), 0)
  const vendorCostElements = (elements || []).reduce((s, e) => s + ((e.vendor_rate || 0) * e.quantity), 0)
  const elementMargin = clientValue - vendorCostElements
  const elementMarginPct = clientValue > 0 ? ((elementMargin / clientValue) * 100).toFixed(1) : '0'

  // ── Vendor SOs committed cost ──────────────────────────────────
  const soCommitted = (vendorSOs || []).filter(so => so.status !== 'cancelled')
    .reduce((s, so) => s + (so.subtotal || 0), 0)

  // ── Vendor payments ────────────────────────────────────────────
  const vendorPaid = (vendorPayments || []).filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const vendorPending = (vendorPayments || []).filter(p => p.status !== 'paid').reduce((s, p) => s + p.amount, 0)

  // ── Expenses ───────────────────────────────────────────────────
  const totalExpenses = (expenses || []).reduce((s, e) => s + e.amount, 0)

  // ── Net ───────────────────────────────────────────────────────
  const totalOut = vendorPaid + totalExpenses
  const netCash = effectiveReceived - totalOut
  const grossMargin = effectiveExpected > 0
    ? (((effectiveExpected - vendorCostElements) / effectiveExpected) * 100).toFixed(1)
    : '0'

  // ── Vendor payment suggestion ──────────────────────────────────
  // After client payment received, suggest which vendors to pay
  const unpaidVendors = (vendorPayments || []).filter(p => p.status !== 'paid')
  const shouldSuggestVendorPayment = effectiveReceived > 0 && unpaidVendors.length > 0

  function pct(part: number, total: number) {
    if (total === 0) return '0'
    return ((part / total) * 100).toFixed(1)
  }

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

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
        <MetricCard
          label="Revenue Billed"
          value={fmt(effectiveExpected)}
          sub={invoice ? `Invoice ${invoice.status}` : `${(payments || []).length} milestones`}
          color="text-white"
        />
        <MetricCard
          label="Vendor Cost"
          value={fmt(vendorCostElements)}
          sub="from element sheet"
          color="text-orange-400"
        />
        <MetricCard
          label="Gross Margin"
          value={fmt(elementMargin)}
          sub={`${elementMarginPct}% of revenue`}
          color={elementMargin >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <MetricCard
          label="Net Cash Position"
          value={fmt(netCash)}
          sub={`${fmt(effectiveReceived)} in − ${fmt(totalOut)} out`}
          color={netCash >= 0 ? 'text-green-400' : 'text-red-400'}
        />
      </div>

      {/* Vendor Payment Suggestion */}
      {shouldSuggestVendorPayment && profile.role === 'director' && (
        <div className="bg-amber-950/20 border border-amber-900/40 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={15} className="text-amber-400" />
            <span className="text-amber-400 font-semibold text-sm">Vendor Payment Suggestion</span>
          </div>
          <p className="text-gray-400 text-xs mb-3">
            You have received {fmt(effectiveReceived)} from the client. Consider releasing payment to pending vendors:
          </p>
          <div className="space-y-2">
            {unpaidVendors.map((vp: any) => {
              // Suggest proportional payment based on collection %
              const collectionPct = effectiveExpected > 0 ? effectiveReceived / effectiveExpected : 0
              const suggested = Math.round(vp.amount * collectionPct)
              return (
                <div key={vp.id} className="flex items-center justify-between py-1.5 border-b border-amber-900/20 last:border-0">
                  <div>
                    <span className="text-gray-300 text-sm">{vp.vendors?.name || 'Unknown'}</span>
                    {vp.vendors?.category && <span className="text-gray-600 text-xs ml-1.5">({vp.vendors.category})</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-white text-sm font-semibold">{fmt(vp.amount)}</span>
                    {suggested > 0 && suggested < vp.amount && (
                      <span className="text-amber-400 text-xs ml-2">→ suggest {fmt(suggested)} ({Math.round(collectionPct * 100)}%)</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-gray-600 text-xs mt-3">
            Go to <Link href={`/dashboard/events/${id}/payments`} className="text-amber-500 hover:text-amber-400">Payments → Vendor tab</Link> to release.
            Vendor payments are always at your discretion — no automatic release.
          </p>
        </div>
      )}

      {/* Revenue Section */}
      <Section title="Revenue — Client Side" icon={<IndianRupee size={14} className="text-green-400" />}>
        {invoice && (
          <>
            <Row label="Invoice Total (Billed)" value={fmt(invoiceTotal)} />
            <Row label="Invoice No." value={invoice.invoice_number || '—'} highlight="text-gray-500" />
            {invoice.gst_amount > 0 && (
              <Row label={`GST (${invoice.gst_mode})`} value={fmt(invoice.gst_amount)} highlight="text-gray-400" />
            )}
            <div className="border-t border-gray-800 mt-2 pt-2" />
          </>
        )}
        <Row label="Expected / Billed" value={fmt(effectiveExpected)} />
        <Row label="Received" value={fmt(effectiveReceived)} highlight="text-green-400" />
        <Row label="Outstanding" value={fmt(clientPending)} highlight={clientPending > 0 ? 'text-amber-400' : 'text-gray-400'} />
        <ProgressBar received={effectiveReceived} total={effectiveExpected} color="bg-green-500" />

        {/* Receipts breakdown */}
        {(receipts || []).length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-800">
            <p className="text-gray-600 text-xs mb-2 font-medium uppercase tracking-wide">Receipts</p>
            {(receipts as any[]).map(r => (
              <div key={r.id} className="flex items-center justify-between py-1 text-xs">
                <span className="text-gray-500">
                  {r.receipt_number || 'Receipt'} · {fmtDate(r.receipt_date)}
                  {r.payment_mode ? ` · ${r.payment_mode.replace('_', ' ')}` : ''}
                </span>
                <span className="text-green-400 font-medium">{fmt(r.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Milestones breakdown */}
        {(payments || []).length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-800">
            <p className="text-gray-600 text-xs mb-2 font-medium uppercase tracking-wide">Milestones</p>
            {(payments as any[]).map(p => (
              <div key={p.id} className="flex items-center justify-between py-1 text-xs">
                <span className="text-gray-500 capitalize">{p.label || p.type}</span>
                <span className={p.status === 'received' ? 'text-green-400 font-medium' : p.status === 'overdue' ? 'text-red-400' : 'text-gray-400'}>
                  {fmt(p.amount)} · {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Element-based Cost Section */}
      <Section title="Costing — Element Sheet" icon={<TrendingDown size={14} className="text-orange-400" />}>
        <Row label="Client Rate Total" value={fmt(clientValue)} />
        <Row label="Vendor Rate Total" value={fmt(vendorCostElements)} highlight="text-orange-400" />
        <Row label="Margin from Elements" value={fmt(elementMargin)} highlight={elementMargin >= 0 ? 'text-green-400' : 'text-red-400'} />
        <Row label="Margin %" value={`${elementMarginPct}%`} highlight={parseFloat(elementMarginPct) >= 20 ? 'text-green-400' : 'text-amber-400'} />
        <p className="text-gray-600 text-xs pt-2">Based on {(elements || []).length} active elements</p>
      </Section>

      {/* Vendor SOs Committed Cost */}
      {(vendorSOs || []).length > 0 && (
        <Section title="Vendor SOs — Committed Cost" icon={<FileText size={14} className="text-blue-400" />}>
          {(vendorSOs as any[]).filter(so => so.status !== 'cancelled').map(so => (
            <Row
              key={so.id}
              label={`${so.vendors?.name || 'Vendor'} · ${so.status}`}
              value={fmt(so.subtotal || 0)}
              highlight="text-blue-400"
            />
          ))}
          <div className="pt-2 border-t border-gray-800">
            <Row label="Total SO Committed" value={fmt(soCommitted)} highlight="text-blue-400" />
            {vendorCostElements > 0 && (
              <Row
                label="vs Element Sheet Vendor Cost"
                value={`${soCommitted > vendorCostElements ? '▲' : '▼'} ${fmt(Math.abs(soCommitted - vendorCostElements))}`}
                highlight={soCommitted > vendorCostElements ? 'text-red-400' : 'text-green-400'}
              />
            )}
          </div>
        </Section>
      )}

      {/* Vendor Payments Section */}
      <Section title="Vendor Payments (Director-Controlled)" icon={<TrendingDown size={14} className="text-orange-400" />}>
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
                label={vp.label}
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
          <Row label="Revenue Billed (Invoice)" value={fmt(effectiveExpected)} />
          <Row label="Cash Received from Client" value={fmt(effectiveReceived)} highlight="text-green-400" />
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
            {effectiveExpected > 0 && effectiveReceived < effectiveExpected && (
              <Row
                label="Collection %"
                value={`${pct(effectiveReceived, effectiveExpected)}%`}
                highlight={parseFloat(pct(effectiveReceived, effectiveExpected)) >= 50 ? 'text-amber-400' : 'text-red-400'}
              />
            )}
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
  const p = total > 0 ? Math.min((received / total) * 100, 100) : 0
  return (
    <div className="mt-3 pt-3 border-t border-gray-800">
      <div className="flex justify-between text-xs text-gray-600 mb-1.5">
        <span>Collection progress</span>
        <span>{p.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${p}%` }} />
      </div>
    </div>
  )
}
