'use client'

import { useState } from 'react'
import { CalendarDays, MapPin, CheckCircle2, Clock, AlertCircle, IndianRupee, FileImage, MessageSquare, ChevronDown, ChevronUp, Plus } from 'lucide-react'

interface Props {
  event: any
  elements: any[]
  payments: any[]
  approvals: any[]
  invoice: any | null
  receipts: any[]
  token: string
}

const PHASES = ['Enquiry', 'Onboard', 'Plan & Cost', 'Recce & Layout', 'Operations', 'Artwork & Print', 'Execution', 'Close']

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-800 text-gray-400',
  approved: 'bg-green-900/50 text-green-400',
  additional: 'bg-amber-900/50 text-amber-400',
}

export default function ClientPortalView({ event, elements, payments, approvals, invoice, receipts, token }: Props) {
  const [showElements, setShowElements] = useState(false)
  const [deciding, setDeciding] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, string>>({})
  const [decided, setDecided] = useState<Record<string, 'approved' | 'changes'>>({})
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [reqForm, setReqForm] = useState({ name: '', specs: '', quantity: '1', notes: '' })
  const [reqLoading, setReqLoading] = useState(false)
  const [reqSent, setReqSent] = useState(false)

  const progress = Math.round((event.current_phase / 7) * 100)
  const totalExpected = payments.reduce((s: number, p: any) => s + p.amount, 0)
  const totalReceived = payments.filter((p: any) => p.status === 'received').reduce((s: number, p: any) => s + p.amount, 0)
  const pendingApprovals = approvals.filter(a => a.status === 'pending' && !decided[a.id])

  async function submitElementRequest() {
    if (!reqForm.name.trim()) return
    setReqLoading(true)
    await fetch('/api/portal/client/request-element', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...reqForm, quantity: parseInt(reqForm.quantity) || 1 }),
    })
    setReqSent(true)
    setReqLoading(false)
    setShowRequestForm(false)
    setReqForm({ name: '', specs: '', quantity: '1', notes: '' })
  }

  async function submitDecision(approvalId: string, decision: 'approved' | 'changes') {
    setDeciding(approvalId)
    await fetch('/api/portal/client/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, approval_id: approvalId, decision, comment: comments[approvalId] || '' }),
    })
    setDecided(d => ({ ...d, [approvalId]: decision }))
    setDeciding(null)
  }

  return (
    <div className="space-y-4 py-2">
      {/* Event Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h1 className="text-white text-xl font-bold mb-1">{event.name}</h1>
        {event.clients?.name && <p className="text-amber-400 text-sm font-medium mb-3">{event.clients.name}</p>}
        <div className="flex flex-wrap gap-3 text-sm text-gray-400 mb-4">
          {event.event_date && (
            <span className="flex items-center gap-1.5">
              <CalendarDays size={13} />
              {new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          )}
          {event.venue && (
            <span className="flex items-center gap-1.5">
              <MapPin size={13} /> {event.venue}{event.city ? `, ${event.city}` : ''}
            </span>
          )}
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Current Stage: <span className="text-white font-medium">{PHASES[event.current_phase]}</span></span>
            <span>{progress}% complete</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-2">
            {PHASES.map((phase, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i <= event.current_phase ? 'bg-amber-500' : 'bg-gray-800'}`} title={phase} />
            ))}
          </div>
        </div>
      </div>

      {/* Pending Design Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-700/40 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={16} className="text-amber-400" />
            <h2 className="text-amber-400 font-semibold text-sm">Action Required — {pendingApprovals.length} design{pendingApprovals.length > 1 ? 's' : ''} waiting for your approval</h2>
          </div>
          <div className="space-y-4">
            {pendingApprovals.map(approval => (
              <div key={approval.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-white font-medium text-sm mb-1">{approval.type}</p>
                <p className="text-gray-500 text-xs mb-3">
                  {new Date(approval.requested_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                {approval.attachment_url && (
                  <a href={approval.attachment_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-amber-500 hover:text-amber-400 text-sm mb-3 transition-colors">
                    <FileImage size={14} /> View Design / Attachment
                  </a>
                )}
                <textarea
                  value={comments[approval.id] || ''}
                  onChange={e => setComments(c => ({ ...c, [approval.id]: e.target.value }))}
                  placeholder="Add your feedback or comments (optional)..."
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:border-amber-500 resize-none placeholder-gray-600"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => submitDecision(approval.id, 'changes')}
                    disabled={deciding === approval.id}
                    className="flex-1 bg-red-950 hover:bg-red-900 text-red-400 font-medium py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
                  >
                    Request Changes
                  </button>
                  <button
                    onClick={() => submitDecision(approval.id, 'approved')}
                    disabled={deciding === approval.id}
                    className="flex-1 bg-green-950 hover:bg-green-900 text-green-400 font-medium py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
                  >
                    {deciding === approval.id ? 'Submitting...' : 'Approve ✓'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decided approvals */}
      {approvals.filter(a => a.status !== 'pending' || decided[a.id]).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold text-sm mb-3">Design History</h2>
          <div className="space-y-2">
            {approvals.filter(a => a.status !== 'pending' || decided[a.id]).map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-gray-300 text-sm">{a.type}</p>
                  {a.comment && <p className="text-gray-600 text-xs mt-0.5">{a.comment}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                  (a.status === 'approved' || decided[a.id] === 'approved') ? 'bg-green-900/50 text-green-400' :
                  decided[a.id] === 'changes' ? 'bg-red-900/50 text-red-400' :
                  'bg-gray-800 text-gray-400'
                }`}>
                  {decided[a.id] === 'approved' ? 'Approved' : decided[a.id] === 'changes' ? 'Changes Requested' : a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Schedule */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <IndianRupee size={16} className="text-amber-500" />
          <h2 className="text-white font-semibold text-sm">Payment Schedule</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-green-400 font-bold text-lg">₹{totalReceived.toLocaleString('en-IN')}</p>
            <p className="text-gray-500 text-xs mt-0.5">Received</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-gray-300 font-bold text-lg">₹{(totalExpected - totalReceived).toLocaleString('en-IN')}</p>
            <p className="text-gray-500 text-xs mt-0.5">Pending</p>
          </div>
        </div>
        {payments.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-4">No payment schedule set yet</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-800 last:border-0">
                <div className="flex items-center gap-2">
                  {p.status === 'received'
                    ? <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
                    : p.status === 'overdue'
                    ? <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                    : <Clock size={14} className="text-gray-500 flex-shrink-0" />
                  }
                  <div>
                    <p className="text-gray-300 text-sm capitalize">{p.label || p.type}</p>
                    {p.due_date && p.status !== 'received' && (
                      <p className="text-gray-600 text-xs">Due: {new Date(p.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    )}
                    {p.received_date && (
                      <p className="text-gray-600 text-xs">Received: {new Date(p.received_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold text-sm">₹{p.amount.toLocaleString('en-IN')}</p>
                  <span className={`text-xs capitalize ${p.status === 'received' ? 'text-green-400' : p.status === 'overdue' ? 'text-red-400' : 'text-gray-500'}`}>
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Element Sheet */}
      {elements.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowElements(!showElements)}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-800/50 transition-colors"
          >
            <h2 className="text-white font-semibold text-sm">Event Elements ({elements.length} items)</h2>
            {showElements ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
          </button>
          {showElements && (
            <div className="border-t border-gray-800">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-5 py-2 text-xs text-gray-600 uppercase tracking-wider font-medium bg-gray-800/50">
                <span>Item</span><span>Size</span><span>Qty</span><span>Status</span>
              </div>
              {elements.map((el: any) => (
                <div key={el.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-5 py-3 border-t border-gray-800 items-center">
                  <div>
                    <p className="text-white text-sm">{el.name}</p>
                    {el.specs && <p className="text-gray-600 text-xs">{el.specs}</p>}
                    {el.vendors?.name && <p className="text-gray-700 text-xs">{el.vendors.name}</p>}
                  </div>
                  <span className="text-gray-400 text-xs">{el.size || '—'}</span>
                  <span className="text-gray-300 text-sm">{el.quantity}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${STATUS_COLORS[el.status] || STATUS_COLORS.pending}`}>
                    {el.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invoice */}
      {invoice && invoice.status !== 'draft' && (
        <div className="bg-gray-900 border border-amber-900/30 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-sm flex items-center gap-2">
              <IndianRupee size={15} className="text-amber-400" /> Invoice
            </h2>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              invoice.status === 'paid' ? 'bg-green-900/50 text-green-400' :
              invoice.status === 'partial' ? 'bg-amber-900/50 text-amber-400' :
              'bg-blue-900/50 text-blue-400'
            }`}>{invoice.status?.toUpperCase()}</span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Invoice No.</span>
              <span className="text-gray-300 font-medium">{invoice.invoice_number || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Amount</span>
              <span className="text-white font-bold">₹{(invoice.total || 0).toLocaleString('en-IN')}</span>
            </div>
            {invoice.total > 0 && totalReceived > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Balance Due</span>
                <span className={`font-semibold ${invoice.total - totalReceived > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  ₹{Math.max(0, invoice.total - totalReceived).toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipts */}
      {receipts.length > 0 && (
        <div className="bg-gray-900 border border-green-900/30 rounded-2xl p-5">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
            <CheckCircle2 size={15} className="text-green-400" /> Payment Receipts
          </h2>
          <div className="space-y-2">
            {receipts.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-gray-300 text-sm font-medium">{r.receipt_number || 'Receipt'}</p>
                  <p className="text-gray-500 text-xs">
                    {new Date(r.receipt_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {r.payment_mode ? ` · ${r.payment_mode.replace('_', ' ')}` : ''}
                    {r.reference_no ? ` · ${r.reference_no}` : ''}
                  </p>
                </div>
                <span className="text-green-400 font-bold text-sm">₹{r.amount.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Additional Element */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-white font-semibold text-sm">Request Additional Element</h2>
          {reqSent && <span className="text-green-400 text-xs">Request sent ✓</span>}
        </div>
        <p className="text-gray-500 text-xs mb-4">Want something added to your event? Let us know and we'll review it.</p>

        {!showRequestForm ? (
          <button
            onClick={() => setShowRequestForm(true)}
            className="flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm transition-colors"
          >
            <Plus size={15} /> Add Request
          </button>
        ) : (
          <div className="space-y-3">
            <input
              value={reqForm.name}
              onChange={e => setReqForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Element name *"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
            />
            <input
              value={reqForm.specs}
              onChange={e => setReqForm(f => ({ ...f, specs: e.target.value }))}
              placeholder="Specifications / description"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
            />
            <input
              type="number"
              value={reqForm.quantity}
              onChange={e => setReqForm(f => ({ ...f, quantity: e.target.value }))}
              min="1"
              placeholder="Quantity"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
            <textarea
              value={reqForm.notes}
              onChange={e => setReqForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional notes or reference..."
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none placeholder-gray-600"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowRequestForm(false)}
                className="flex-1 bg-gray-800 text-gray-400 rounded-xl py-2.5 text-sm hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitElementRequest}
                disabled={!reqForm.name.trim() || reqLoading}
                className="flex-1 bg-amber-500 text-black font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50 hover:bg-amber-400 transition-colors"
              >
                {reqLoading ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-gray-700 text-xs text-center py-2">
        For any queries: +91 86023 71023 · creativeeraevents@gmail.com
      </p>
    </div>
  )
}
