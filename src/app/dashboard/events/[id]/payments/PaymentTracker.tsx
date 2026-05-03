'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, CheckCircle2, Clock, AlertCircle, IndianRupee, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

interface ClientPayment {
  id: string
  type: 'advance' | 'milestone' | 'final'
  label?: string
  amount: number
  due_date?: string
  received_date?: string
  status: 'pending' | 'received' | 'overdue'
  notes?: string
}

interface VendorPayment {
  id: string
  vendor_id: string
  amount: number
  due_date?: string
  paid_date?: string
  status: 'pending' | 'paid' | 'overdue'
  label?: string
  notes?: string
  vendors?: { name: string; category?: string }
}

interface Props {
  eventId: string
  payments: ClientPayment[]
  vendorPayments: VendorPayment[]
  vendors: { id: string; name: string; category?: string }[]
  isDirector: boolean
}

const CLIENT_TYPE_COLORS = {
  advance: 'bg-blue-900/50 text-blue-400',
  milestone: 'bg-purple-900/50 text-purple-400',
  final: 'bg-green-900/50 text-green-400',
}

export default function PaymentTracker({ eventId, payments, vendorPayments, vendors, isDirector }: Props) {
  const [tab, setTab] = useState<'client' | 'vendor'>('client')
  const [showClientForm, setShowClientForm] = useState(false)
  const [showVendorForm, setShowVendorForm] = useState(false)
  const [clientForm, setClientForm] = useState({ type: 'advance', amount: '', due_date: '', notes: '' })
  const [vendorForm, setVendorForm] = useState({ vendor_id: '', label: '', amount: '', due_date: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [marking, setMarking] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Summaries
  const clientTotal = payments.reduce((s, p) => s + p.amount, 0)
  const clientReceived = payments.filter(p => p.status === 'received').reduce((s, p) => s + p.amount, 0)
  const vendorTotal = vendorPayments.reduce((s, p) => s + p.amount, 0)
  const vendorPaid = vendorPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)

  async function addClientPayment(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('payments').insert({
      event_id: eventId,
      type: clientForm.type,
      amount: parseFloat(clientForm.amount),
      due_date: clientForm.due_date || null,
      notes: clientForm.notes || null,
      status: 'pending',
    })
    setClientForm({ type: 'advance', amount: '', due_date: '', notes: '' })
    setShowClientForm(false)
    router.refresh()
    setLoading(false)
  }

  async function addVendorPayment(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('vendor_payments').insert({
      event_id: eventId,
      vendor_id: vendorForm.vendor_id,
      label: vendorForm.label || null,
      amount: parseFloat(vendorForm.amount),
      due_date: vendorForm.due_date || null,
      notes: vendorForm.notes || null,
      status: 'pending',
    })
    setVendorForm({ vendor_id: '', label: '', amount: '', due_date: '', notes: '' })
    setShowVendorForm(false)
    router.refresh()
    setLoading(false)
  }

  async function markClientPayment(id: string, status: 'received' | 'overdue') {
    setMarking(id)
    await supabase.from('payments').update({
      status,
      received_date: status === 'received' ? new Date().toISOString().split('T')[0] : null,
    }).eq('id', id)
    router.refresh()
    setMarking(null)
  }

  async function markVendorPayment(id: string, status: 'paid' | 'overdue') {
    setMarking(id)
    await supabase.from('vendor_payments').update({
      status,
      paid_date: status === 'paid' ? new Date().toISOString().split('T')[0] : null,
    }).eq('id', id)
    router.refresh()
    setMarking(null)
  }

  const inputClass = "w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"

  return (
    <div>
      {/* Overview Summary */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-gray-900 border border-green-900/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownCircle size={16} className="text-green-400" />
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">From Client</span>
          </div>
          <p className="text-white font-bold text-lg">₹{clientReceived.toLocaleString('en-IN')}</p>
          <p className="text-gray-500 text-xs mt-0.5">of ₹{clientTotal.toLocaleString('en-IN')} expected</p>
        </div>
        <div className="bg-gray-900 border border-orange-900/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle size={16} className="text-orange-400" />
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">To Vendors</span>
          </div>
          <p className="text-white font-bold text-lg">₹{vendorPaid.toLocaleString('en-IN')}</p>
          <p className="text-gray-500 text-xs mt-0.5">of ₹{vendorTotal.toLocaleString('en-IN')} due</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-900 border border-gray-800 rounded-xl p-1">
        <button
          onClick={() => setTab('client')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'client' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}`}
        >
          <ArrowDownCircle size={14} /> Client Payments
        </button>
        <button
          onClick={() => setTab('vendor')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${tab === 'vendor' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}`}
        >
          <ArrowUpCircle size={14} /> Vendor Payments
        </button>
      </div>

      {/* CLIENT PAYMENTS TAB */}
      {tab === 'client' && (
        <div>
          {isDirector && (
            <div className="flex justify-end mb-4">
              <button onClick={() => setShowClientForm(!showClientForm)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
                <Plus size={16} /> Add Payment
              </button>
            </div>
          )}

          {showClientForm && (
            <form onSubmit={addClientPayment} className="bg-gray-900 border border-amber-700/40 rounded-2xl p-5 mb-4 space-y-3">
              <h3 className="text-white font-semibold text-sm">New Client Payment</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select value={clientForm.type} onChange={e => setClientForm(f => ({ ...f, type: e.target.value }))} className={inputClass}>
                    <option value="advance">Advance</option>
                    <option value="milestone">Milestone</option>
                    <option value="final">Final Payment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount (₹) *</label>
                  <input type="number" value={clientForm.amount} onChange={e => setClientForm(f => ({ ...f, amount: e.target.value }))} required placeholder="0" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                <input type="date" value={clientForm.due_date} onChange={e => setClientForm(f => ({ ...f, due_date: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input type="text" value={clientForm.notes} onChange={e => setClientForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. 50% advance as per agreement" className={inputClass} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowClientForm(false)} className="flex-1 bg-gray-800 text-gray-400 rounded-xl py-2.5 text-sm">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 bg-amber-500 text-black font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50">{loading ? 'Adding...' : 'Add'}</button>
              </div>
            </form>
          )}

          {payments.length === 0 ? (
            <EmptyState icon={<IndianRupee size={28} />} text="No client payments tracked yet" />
          ) : (
            <div className="space-y-2">
              {payments.map(p => (
                <PaymentCard
                  key={p.id}
                  title={p.type}
                  badge={CLIENT_TYPE_COLORS[p.type]}
                  subtitle={p.label}
                  amount={p.amount}
                  status={p.status}
                  statusColor={p.status === 'received' ? 'text-green-400' : p.status === 'overdue' ? 'text-red-400' : 'text-gray-400'}
                  date={p.received_date ? `Received: ${fmt(p.received_date)}` : p.due_date ? `Due: ${fmt(p.due_date)}` : undefined}
                  notes={p.notes}
                  actions={isDirector && p.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button onClick={() => markClientPayment(p.id, 'overdue')} disabled={marking === p.id} className="text-xs bg-red-950 hover:bg-red-900 text-red-400 px-3 py-1.5 rounded-lg">Overdue</button>
                      <button onClick={() => markClientPayment(p.id, 'received')} disabled={marking === p.id} className="text-xs bg-green-950 hover:bg-green-900 text-green-400 px-3 py-1.5 rounded-lg">Mark Received</button>
                    </div>
                  ) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* VENDOR PAYMENTS TAB */}
      {tab === 'vendor' && (
        <div>
          {/* Decoupling notice — always visible */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
            <span className="text-amber-500 mt-0.5 text-lg">⚡</span>
            <div>
              <p className="text-gray-300 text-xs font-semibold">Vendor payments are director-controlled</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Pay vendors whenever funds are available — completely independent of client receipts.
                Late client payment or re-allocation of funds does not affect this.
              </p>
            </div>
          </div>

          {isDirector && (
            <div className="flex justify-end mb-4">
              <button onClick={() => setShowVendorForm(!showVendorForm)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
                <Plus size={16} /> Pay Vendor
              </button>
            </div>
          )}

          {showVendorForm && (
            <form onSubmit={addVendorPayment} className="bg-gray-900 border border-amber-700/40 rounded-2xl p-5 mb-4 space-y-3">
              <h3 className="text-white font-semibold text-sm">Pay Vendor</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Vendor *</label>
                  <select value={vendorForm.vendor_id} onChange={e => setVendorForm(f => ({ ...f, vendor_id: e.target.value }))} required className={inputClass}>
                    <option value="">Select vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.category ? ` (${v.category})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Payment For</label>
                  <input type="text" value={vendorForm.label} onChange={e => setVendorForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Advance for printing" className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount (₹) *</label>
                  <input type="number" value={vendorForm.amount} onChange={e => setVendorForm(f => ({ ...f, amount: e.target.value }))} required placeholder="0" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date (leave blank if future)</label>
                  <input type="date" value={vendorForm.due_date} onChange={e => setVendorForm(f => ({ ...f, due_date: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input type="text" value={vendorForm.notes} onChange={e => setVendorForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal reference, mode of payment, etc." className={inputClass} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowVendorForm(false)} className="flex-1 bg-gray-800 text-gray-400 rounded-xl py-2.5 text-sm">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 bg-amber-500 text-black font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50">{loading ? 'Adding...' : 'Add'}</button>
              </div>
            </form>
          )}

          {vendorPayments.length === 0 ? (
            <EmptyState icon={<ArrowUpCircle size={28} />} text="No vendor payments tracked yet" />
          ) : (
            <div className="space-y-2">
              {vendorPayments.map(p => (
                <PaymentCard
                  key={p.id}
                  title={p.vendors?.name || 'Unknown Vendor'}
                  badge="bg-gray-800 text-gray-400"
                  badgeText={p.vendors?.category}
                  subtitle={p.label}
                  amount={p.amount}
                  status={p.status}
                  statusColor={p.status === 'paid' ? 'text-green-400' : p.status === 'overdue' ? 'text-red-400' : 'text-gray-400'}
                  date={p.paid_date ? `Paid: ${fmt(p.paid_date)}` : p.due_date ? `Due: ${fmt(p.due_date)}` : undefined}
                  notes={p.notes}
                  actions={isDirector && p.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button onClick={() => markVendorPayment(p.id, 'overdue')} disabled={marking === p.id} className="text-xs bg-red-950 hover:bg-red-900 text-red-400 px-3 py-1.5 rounded-lg">Overdue</button>
                      <button onClick={() => markVendorPayment(p.id, 'paid')} disabled={marking === p.id} className="text-xs bg-green-950 hover:bg-green-900 text-green-400 px-3 py-1.5 rounded-lg">Mark Paid</button>
                    </div>
                  ) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function EmptyState({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
      <div className="text-gray-700 flex justify-center mb-3">{icon}</div>
      <p className="text-gray-500 text-sm">{text}</p>
    </div>
  )
}

function PaymentCard({ title, badge, badgeText, subtitle, amount, status, statusColor, date, notes, actions }: {
  title: string, badge: string, badgeText?: string, subtitle?: string, amount: number,
  status: string, statusColor: string, date?: string, notes?: string,
  actions?: React.ReactNode
}) {
  return (
    <div className={`bg-gray-900 border rounded-2xl p-4 ${status === 'received' || status === 'paid' ? 'border-green-900/30' : status === 'overdue' ? 'border-red-900/30' : 'border-gray-800'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {status === 'received' || status === 'paid'
              ? <CheckCircle2 size={14} className="text-green-400" />
              : status === 'overdue'
              ? <AlertCircle size={14} className="text-red-400" />
              : <Clock size={14} className="text-gray-400" />
            }
            <span className="text-white font-semibold">₹{amount.toLocaleString('en-IN')}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${badge}`}>{badgeText || title}</span>
            <span className={`text-xs capitalize ${statusColor}`}>{status}</span>
          </div>
          {subtitle && <p className="text-gray-400 text-xs mt-1 font-medium">{subtitle}</p>}
          {date && <p className="text-gray-500 text-xs mt-0.5">{date}</p>}
          {notes && <p className="text-gray-600 text-xs mt-0.5">{notes}</p>}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </div>
  )
}
