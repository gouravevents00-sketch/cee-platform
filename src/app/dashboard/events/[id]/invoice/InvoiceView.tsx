'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Printer, Send, CheckCircle2, FileText, Plus, Trash2, MessageCircle, Copy, Check } from 'lucide-react'

// ══════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════

interface InvoiceItem {
  description: string
  specs?: string
  qty: number
  days: number
  rate: number
  amount: number
}

interface Payment {
  id: string
  type: string
  label?: string
  amount: number
  due_date?: string
  received_date?: string
  status: 'pending' | 'received' | 'overdue'
}

interface Receipt {
  id: string
  receipt_number?: string
  receipt_date: string
  amount: number
  payment_mode: string
  reference_no?: string
}

interface Props {
  eventId: string
  eventName: string
  clientName?: string
  clientContact?: string
  clientPhone?: string
  clientEmail?: string
  clientType?: string
  invoice: any
  payments: Payment[]
  receipts: Receipt[]
  isDirector: boolean
  canEdit: boolean
  company: { name: string; tagline: string; contact: string; footer: string; prefix: string }
}

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════

const gold = '#c9a84c'
const navy = '#1a1a2e'
const tbl = '#2d3561'

function fmt(n: number) { return Math.round(n).toLocaleString('en-IN') }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function numToWords(n: number): string {
  if (n <= 0) return ''
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  function b100(x: number): string { return x < 20 ? ones[x] : tens[Math.floor(x/10)] + (x%10 ? ' '+ones[x%10] : '') }
  function b1k(x: number): string { return x < 100 ? b100(x) : ones[Math.floor(x/100)]+' Hundred'+(x%100?' '+b100(x%100):'') }
  let r = '', rem = n
  if (rem >= 10000000) { r += b1k(Math.floor(rem/10000000))+' Crore '; rem %= 10000000 }
  if (rem >= 100000)   { r += b1k(Math.floor(rem/100000))+' Lakh '; rem %= 100000 }
  if (rem >= 1000)     { r += b1k(Math.floor(rem/1000))+' Thousand '; rem %= 1000 }
  if (rem > 0)         { r += b1k(rem) }
  return r.trim()
}

const MODE_LABELS: Record<string, string> = {
  cash: 'Cash', cheque: 'Cheque', bank_transfer: 'Bank Transfer',
  upi: 'UPI', neft: 'NEFT', rtgs: 'RTGS', other: 'Other',
}

// ══════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════

export default function InvoiceView({
  eventId, eventName, clientName, clientContact, clientPhone, clientEmail, clientType,
  invoice, payments, receipts: initReceipts, isDirector, canEdit, company,
}: Props) {
  const [items, setItems] = useState<InvoiceItem[]>(invoice?.items?.length ? invoice.items : [])
  const [invStatus, setInvStatus] = useState<string>(invoice?.status || 'draft')
  const [saving, setSaving] = useState(false)
  const [receipts, setReceipts] = useState<Receipt[]>(initReceipts)
  const [reminderCopied, setReminderCopied] = useState(false)

  // Receipt modal state
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [receiptForm, setReceiptForm] = useState({ payment_mode: 'bank_transfer', reference_no: '', notes: '' })
  const [creatingReceipt, setCreatingReceipt] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const invoiceId = invoice?.id
  const invoiceNumber = invoice?.invoice_number || `INV-${eventId.slice(0, 6).toUpperCase()}`
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const invDate = invoice?.invoice_date ? fmtDate(invoice.invoice_date) : today
  const gstMode = invoice?.gst_mode || 'none'
  const subtotal = invoice?.subtotal || items.reduce((s, it) => s + it.amount, 0)
  const gstAmt = invoice?.gst_amount || 0
  const grandTotal = invoice?.total || subtotal + gstAmt
  const totalReceived = receipts.reduce((s, r) => s + r.amount, 0)
  const balanceDue = grandTotal - totalReceived

  // ── Mark invoice sent ──────────────────────────────────────────
  async function markSent() {
    if (!invoiceId || !canEdit) return
    setSaving(true)
    await supabase.from('client_invoices').update({ status: 'sent' }).eq('id', invoiceId)
    setInvStatus('sent')
    setSaving(false)
    router.refresh()
  }

  // ── Open receipt modal ─────────────────────────────────────────
  function openReceiptModal(p: Payment) {
    setSelectedPayment(p)
    setReceiptForm({ payment_mode: 'bank_transfer', reference_no: '', notes: '' })
    setShowReceiptModal(true)
  }

  // ── Create receipt + mark payment received ─────────────────────
  async function createReceipt() {
    if (!selectedPayment || !isDirector) return
    setCreatingReceipt(true)

    // 1. Mark payment received
    await supabase.from('payments').update({
      status: 'received',
      received_date: new Date().toISOString().split('T')[0],
      payment_mode: receiptForm.payment_mode,
      reference_no: receiptForm.reference_no || null,
    }).eq('id', selectedPayment.id)

    // 2. Generate receipt number
    const eventCode = eventId.slice(0, 6).toUpperCase()
    const payCode = selectedPayment.id.slice(0, 4).toUpperCase()
    const receiptNumber = `${company.prefix}/REC/${eventCode}/${payCode}`

    // 3. Insert receipt
    const { data: newReceipt } = await supabase.from('client_receipts').insert({
      event_id: eventId,
      invoice_id: invoiceId || null,
      payment_id: selectedPayment.id,
      receipt_number: receiptNumber,
      receipt_date: new Date().toISOString().split('T')[0],
      amount: selectedPayment.amount,
      payment_mode: receiptForm.payment_mode,
      reference_no: receiptForm.reference_no || null,
      notes: receiptForm.notes || null,
    }).select().single()

    if (newReceipt) {
      setReceipts(prev => [...prev, newReceipt as Receipt])
    }

    setShowReceiptModal(false)
    setCreatingReceipt(false)
    router.refresh()
  }

  const pendingPayments = payments.filter(p => p.status === 'pending')
  const inputCls = 'w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500'

  // ── Generate WhatsApp-ready payment reminder ───────────────────
  function generateReminder(): string {
    const name = clientContact || clientName || 'Sir/Madam'
    const nextDue = pendingPayments.find(p => p.due_date)
    const dueStr = nextDue?.due_date ? `\nDue Date: ${fmtDate(nextDue.due_date)}` : ''
    const type = clientType || 'corporate'

    if (type === 'agency') {
      return `Hi ${name}! 👋
Just a friendly reminder from *${company.name}* for *${eventName}*.

🧾 Invoice: *${invoiceNumber}*
💰 Total: ₹${fmt(grandTotal)}
✅ Received: ₹${fmt(totalReceived)}
⏳ *Balance Due: ₹${fmt(Math.max(0, balanceDue))}*${dueStr}

Whenever convenient, please process the payment. Let us know if you need any details or a revised copy!

Thanks & Regards,
${company.name}
+91 86023 71023`
    }

    if (type === 'government') {
      return `Respected Sir/Madam,

*Subject: Payment Reminder — Invoice ${invoiceNumber} | ${eventName}*

With due respect, we wish to draw your kind attention to the pending invoice amount against services rendered by our organisation for the above event.

Invoice No: *${invoiceNumber}*
Invoice Amount: ₹${fmt(grandTotal)}
Amount Received: ₹${fmt(totalReceived)}
*Balance Pending: ₹${fmt(Math.max(0, balanceDue))}*${dueStr}

We humbly request your good office to kindly arrange for the release of the pending payment at the earliest convenience.

Yours faithfully,
${company.name}
Indore, Madhya Pradesh
📞 +91 86023 71023`
    }

    // default: corporate
    return `Dear ${name},

This is a gentle reminder regarding the pending invoice for *${eventName}*.

Invoice No: *${invoiceNumber}*
Invoice Amount: ₹${fmt(grandTotal)}
Amount Received: ₹${fmt(totalReceived)}
*Balance Due: ₹${fmt(Math.max(0, balanceDue))}*${dueStr}

We request you to kindly arrange for the payment at your earliest convenience. Please feel free to reach out for any clarifications.

Warm Regards,
${company.name}
+91 86023 71023`
  }

  async function copyReminder() {
    await navigator.clipboard.writeText(generateReminder())
    setReminderCopied(true)
    setTimeout(() => setReminderCopied(false), 2500)
  }

  return (
    <div className="space-y-4">

      {/* ── TOP BAR ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap print:hidden">
        {/* Status badge */}
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          invStatus === 'paid' ? 'bg-green-900/50 text-green-400' :
          invStatus === 'sent' ? 'bg-blue-900/50 text-blue-400' :
          invStatus === 'partial' ? 'bg-amber-900/50 text-amber-400' :
          invStatus === 'overdue' ? 'bg-red-900/50 text-red-400' :
          'bg-gray-800 text-gray-400'
        }`}>{invStatus.toUpperCase()}</span>

        {/* Mark Sent */}
        {canEdit && invStatus === 'draft' && (
          <button onClick={markSent} disabled={saving}
            className="flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-blue-400 text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
            <Send size={13} /> Mark Sent to Client
          </button>
        )}

        {/* Record Payment — opens modal */}
        {isDirector && pendingPayments.length > 0 && (
          <div className="relative group">
            <button className="flex items-center gap-1.5 bg-green-950 hover:bg-green-900 text-green-400 text-sm px-4 py-2 rounded-xl transition-colors">
              <CheckCircle2 size={13} /> Record Payment Received
            </button>
            <div className="absolute top-full left-0 mt-1 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-10 hidden group-hover:block">
              {pendingPayments.map(p => (
                <button key={p.id} onClick={() => openReceiptModal(p)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-0 text-sm">
                  <p className="text-white font-medium">₹{fmt(p.amount)}</p>
                  <p className="text-gray-500 text-xs">{p.label || p.type}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="ml-auto flex gap-2">
          {balanceDue > 0 && invStatus !== 'paid' && (
            <button onClick={copyReminder}
              className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl transition-colors ${
                reminderCopied
                  ? 'bg-green-900/50 text-green-400'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}>
              {reminderCopied ? <Check size={13} /> : <MessageCircle size={13} />}
              {reminderCopied ? 'Copied!' : 'Copy Reminder'}
            </button>
          )}
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm px-4 py-2 rounded-xl transition-colors">
            <Printer size={13} /> Print Invoice
          </button>
        </div>
      </div>

      {/* ── RECEIPT MODAL ─────────────────────────────────────────── */}
      {showReceiptModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 print:hidden">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-white font-bold text-lg mb-1">Record Payment Received</h3>
            <p className="text-gray-500 text-sm mb-4">
              ₹{fmt(selectedPayment.amount)} — {selectedPayment.label || selectedPayment.type}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Payment Mode</label>
                <select value={receiptForm.payment_mode}
                  onChange={e => setReceiptForm(f => ({ ...f, payment_mode: e.target.value }))}
                  className={inputCls}>
                  {Object.entries(MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Reference No. (UTR / Cheque No.)</label>
                <input type="text" value={receiptForm.reference_no}
                  onChange={e => setReceiptForm(f => ({ ...f, reference_no: e.target.value }))}
                  placeholder="Optional" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input type="text" value={receiptForm.notes}
                  onChange={e => setReceiptForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional" className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowReceiptModal(false)}
                className="flex-1 bg-gray-800 text-gray-400 rounded-xl py-2.5 text-sm">Cancel</button>
              <button onClick={createReceipt} disabled={creatingReceipt}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50">
                {creatingReceipt ? 'Creating...' : 'Confirm & Create Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT SUMMARY (screen only) ────────────────────────── */}
      {grandTotal > 0 && (
        <div className="grid grid-cols-3 gap-3 print:hidden">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">Invoice Total</p>
            <p className="text-white font-bold">₹{fmt(grandTotal)}</p>
          </div>
          <div className="bg-gray-900 border border-green-900/30 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">Received</p>
            <p className="text-green-400 font-bold">₹{fmt(totalReceived)}</p>
          </div>
          <div className={`bg-gray-900 rounded-xl p-4 border ${balanceDue > 0 ? 'border-amber-900/40' : 'border-green-900/30'}`}>
            <p className="text-gray-500 text-xs mb-1">Balance Due</p>
            <p className={`font-bold ${balanceDue > 0 ? 'text-amber-400' : 'text-green-400'}`}>₹{fmt(Math.max(0, balanceDue))}</p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          INVOICE DOCUMENT
      ══════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl print:shadow-none print:rounded-none" id="invoice-doc">

        {/* Letterhead */}
        <div className="px-8 py-6 flex items-start justify-between" style={{ background: navy }}>
          <div>
            <p className="font-black text-lg tracking-widest uppercase" style={{ color: gold }}>{company.name}</p>
            <p className="text-xs mt-1" style={{ color: '#aab' }}>{company.tagline}</p>
            <p className="text-xs mt-2" style={{ color: '#ccc' }}>{company.contact}</p>
          </div>
          <div className="text-right">
            <p className="font-black text-xl tracking-widest" style={{ color: gold }}>INVOICE</p>
            <div className="text-xs mt-2 space-y-0.5" style={{ color: '#ccc' }}>
              <p>No: <span className="text-white font-semibold">{invoiceNumber}</span></p>
              <p>Date: {invDate}</p>
              {balanceDue > 0 && invoice?.due_date && (
                <p>Due: {fmtDate(invoice.due_date)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Client + Event */}
        <div className="grid grid-cols-2 border-b-2" style={{ borderColor: navy }}>
          <div className="px-8 py-4 border-r border-gray-200">
            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: gold }}>Billed To</p>
            <div className="space-y-1 text-sm">
              {[['Client / Company', clientName], ['Contact', clientContact], ['Phone', clientPhone], ['Email', clientEmail]].map(([lbl, val]) => val ? (
                <div key={lbl} className="flex gap-3">
                  <span className="text-gray-400 w-28 flex-shrink-0 text-xs">{lbl}</span>
                  <span className="font-semibold text-gray-900">{val}</span>
                </div>
              ) : null)}
            </div>
          </div>
          <div className="px-8 py-4">
            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: gold }}>Event Details</p>
            <div className="space-y-1 text-sm">
              <div className="flex gap-3">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Event Name</span>
                <span className="font-semibold text-gray-900">{eventName}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Invoice No.</span>
                <span className="text-gray-700">{invoiceNumber}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-gray-400 w-28 flex-shrink-0 text-xs">Status</span>
                <span className={`text-xs font-semibold uppercase ${invStatus === 'paid' ? 'text-green-600' : invStatus === 'partial' ? 'text-amber-600' : 'text-gray-600'}`}>{invStatus}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Items header */}
        <div className="px-8 py-2 text-xs font-black uppercase tracking-widest" style={{ background: navy, color: gold }}>
          Items &amp; Services
        </div>

        {/* Items table */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: tbl }}>
              <th className="text-left px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-8 pl-8">#</th>
              <th className="text-left px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide">Description</th>
              <th className="text-left px-3 py-2.5 text-white text-xs font-bold uppercase tracking-wide">Spec</th>
              <th className="text-center px-2 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-14">Days</th>
              <th className="text-center px-2 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-14">Qty</th>
              <th className="text-right px-2 py-2.5 text-white text-xs font-bold uppercase tracking-wide w-24">Rate (₹)</th>
              <th className="text-right px-3 py-2.5 pr-8 text-white text-xs font-bold uppercase tracking-wide w-28">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-amber-50 transition-colors" style={{ background: i % 2 === 0 ? '#fff' : '#fef9f0' }}>
                <td className="px-3 py-2 text-gray-400 text-xs text-center pl-8">{i + 1}</td>
                <td className="px-3 py-2 text-gray-900 font-medium">{item.description}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{item.specs || '—'}</td>
                <td className="px-2 py-2 text-center text-gray-700">{item.days || 1}</td>
                <td className="px-2 py-2 text-center text-gray-700">{item.qty || 1}</td>
                <td className="px-2 py-2 text-right text-gray-700">₹{fmt(item.rate || 0)}</td>
                <td className="px-3 py-2 pr-8 text-right font-semibold" style={{ color: '#a0875a' }}>₹{fmt(item.amount || 0)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-8 py-6 text-center text-gray-400 text-sm">
                  No items — lock quotation to auto-populate
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end px-8 pb-6 pt-2 border-t-2" style={{ borderColor: navy }}>
          <div className="w-72 space-y-1.5 text-sm">
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold">₹ {fmt(subtotal)}</span>
            </div>
            {gstMode !== 'none' && (
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-600">GST 18% ({gstMode === 'exclusive' ? 'added' : 'included'})</span>
                <span className="font-semibold">₹ {fmt(gstAmt)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 px-3 rounded-lg mt-2" style={{ background: navy }}>
              <span className="font-black uppercase tracking-wide text-xs" style={{ color: gold }}>Total Due</span>
              <span className="font-black text-white text-base">₹ {fmt(grandTotal)}</span>
            </div>
            {grandTotal > 0 && (
              <p className="text-right text-gray-400 text-xs italic">
                Rupees {numToWords(Math.round(grandTotal))} Only
              </p>
            )}
            {totalReceived > 0 && (
              <>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-green-600">Amount Received</span>
                  <span className="text-green-600 font-semibold">- ₹ {fmt(totalReceived)}</span>
                </div>
                <div className="flex justify-between py-2 px-3 rounded-lg" style={{ background: balanceDue > 0 ? '#92400e20' : '#14532d20' }}>
                  <span className={`font-black uppercase tracking-wide text-xs ${balanceDue > 0 ? 'text-amber-600' : 'text-green-600'}`}>Balance Due</span>
                  <span className={`font-black text-base ${balanceDue > 0 ? 'text-amber-600' : 'text-green-600'}`}>₹ {fmt(Math.max(0, balanceDue))}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Payment Schedule (from milestones) */}
        {payments.length > 0 && (
          <div className="px-8 py-5 border-t border-gray-200 bg-amber-50">
            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: gold }}>Payment Schedule</p>
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {p.status === 'received'
                      ? <span className="text-green-500 text-xs">✓</span>
                      : p.status === 'overdue'
                      ? <span className="text-red-500 text-xs">!</span>
                      : <span className="text-gray-400 text-xs">○</span>
                    }
                    <span className="text-gray-700">{p.label || p.type}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {p.received_date && <span className="text-green-600 text-xs">Recd: {fmtDate(p.received_date)}</span>}
                    {!p.received_date && p.due_date && <span className="text-gray-500 text-xs">Due: {fmtDate(p.due_date)}</span>}
                    <span className={`font-semibold w-28 text-right ${p.status === 'received' ? 'text-green-600' : 'text-gray-900'}`}>
                      ₹ {fmt(p.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-3 flex items-center justify-between border-t border-gray-200" style={{ background: navy }}>
          <p className="text-xs" style={{ color: '#888' }}>{company.footer}</p>
          <p className="text-xs" style={{ color: '#888' }}>#{invoiceNumber}</p>
        </div>
      </div>

      {/* ── RECEIPTS SECTION ──────────────────────────────────────── */}
      {receipts.length > 0 && (
        <div className="space-y-3 print:hidden">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <FileText size={16} className="text-green-400" />
            Receipts ({receipts.length})
          </h2>
          {receipts.map(r => (
            <ReceiptCard key={r.id} receipt={r} eventName={eventName} clientName={clientName} company={company} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Receipt Card + Print ──────────────────────────────────────────
function ReceiptCard({ receipt, eventName, clientName, company }: {
  receipt: Receipt, eventName: string, clientName?: string,
  company: { name: string; contact: string; footer: string; prefix: string }
}) {
  const [showPrint, setShowPrint] = useState(false)

  function printReceipt() {
    setShowPrint(true)
    setTimeout(() => {
      const el = document.getElementById(`receipt-${receipt.id}`)
      if (!el) return
      const win = window.open('', '_blank')
      if (!win) return
      win.document.write(`<html><head><title>Receipt</title><style>
        body { font-family: 'Georgia', serif; margin: 0; }
        @media print { body { margin: 0; } }
      </style></head><body>${el.innerHTML}</body></html>`)
      win.document.close()
      win.print()
      win.close()
      setShowPrint(false)
    }, 100)
  }

  return (
    <div className="bg-gray-900 border border-green-900/30 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-semibold text-sm">✓ {receipt.receipt_number || 'Receipt'}</span>
            <span className="text-gray-500 text-xs">{fmtDate(receipt.receipt_date)}</span>
          </div>
          <p className="text-white font-bold mt-0.5">₹{(receipt.amount).toLocaleString('en-IN')}</p>
          <p className="text-gray-500 text-xs">{MODE_LABELS[receipt.payment_mode] || receipt.payment_mode}
            {receipt.reference_no ? ` · ${receipt.reference_no}` : ''}</p>
        </div>
        <button onClick={printReceipt}
          className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-2 rounded-xl transition-colors">
          <Printer size={11} /> Print
        </button>
      </div>

      {/* Hidden receipt document for printing */}
      <div id={`receipt-${receipt.id}`} className="hidden">
        <div style={{ width: '400px', margin: '40px auto', fontFamily: 'Georgia, serif', border: '2px solid #1a1a2e', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ background: '#1a1a2e', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: '#c9a84c', fontWeight: 900, fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>{company.name}</p>
              <p style={{ color: '#ccc', fontSize: '10px', marginTop: '4px' }}>{company.contact}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#c9a84c', fontWeight: 900, fontSize: '18px', margin: 0 }}>RECEIPT</p>
              <p style={{ color: '#ccc', fontSize: '10px', marginTop: '4px' }}>{receipt.receipt_number}</p>
            </div>
          </div>
          <div style={{ padding: '20px 24px', background: '#fef9f0' }}>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: '#a0875a', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Received From</p>
              <p style={{ color: '#2d2d2d', fontWeight: 700, fontSize: '14px', margin: 0 }}>{clientName || '—'}</p>
              <p style={{ color: '#6b5b45', fontSize: '12px', margin: '2px 0 0' }}>For: {eventName}</p>
            </div>
            <div style={{ background: '#1a1a2e', borderRadius: '6px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ color: '#c9a84c', fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Amount Received</span>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: '18px' }}>₹{receipt.amount.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
              <div><span style={{ color: '#a0875a' }}>Date: </span><span style={{ color: '#2d2d2d' }}>{fmtDate(receipt.receipt_date)}</span></div>
              <div><span style={{ color: '#a0875a' }}>Mode: </span><span style={{ color: '#2d2d2d' }}>{MODE_LABELS[receipt.payment_mode]}</span></div>
              {receipt.reference_no && (
                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#a0875a' }}>Ref No.: </span><span style={{ color: '#2d2d2d' }}>{receipt.reference_no}</span></div>
              )}
            </div>
            <div style={{ marginTop: '24px', borderTop: '1px solid #e8d5a3', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <p style={{ color: '#a0875a', fontSize: '10px', margin: 0 }}>Authorised Signatory</p>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: '#a0875a', fontSize: '10px', margin: 0 }}>{company.footer}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
