'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Printer, Save, Send } from 'lucide-react'

interface QuoteItem {
  description: string
  specs: string
  qty: number
  rate: number
  amount: number
}

interface ExistingQuotation {
  id: string
  quote_number: string
  items: QuoteItem[]
  subtotal: number
  gst_percent: number
  gst_amount: number
  total: number
  validity_days: number
  notes: string
  status: string
  created_at: string
}

interface Props {
  eventId: string
  eventName: string
  clientName?: string
  clientContact?: string
  existingQuotation?: ExistingQuotation | null
}

const EMPTY_ITEM: QuoteItem = { description: '', specs: '', qty: 1, rate: 0, amount: 0 }

export default function QuotationBuilder({ eventId, eventName, clientName, clientContact, existingQuotation }: Props) {
  const [items, setItems] = useState<QuoteItem[]>(
    existingQuotation?.items?.length ? existingQuotation.items : [{ ...EMPTY_ITEM }]
  )
  const [gstPercent, setGstPercent] = useState(existingQuotation?.gst_percent ?? 18)
  const [applyGst, setApplyGst] = useState((existingQuotation?.gst_percent ?? 18) > 0)
  const [validity, setValidity] = useState(existingQuotation?.validity_days ?? 7)
  const [notes, setNotes] = useState(existingQuotation?.notes ?? '')
  const [quoteId, setQuoteId] = useState(existingQuotation?.id ?? null)
  const [quoteNumber, setQuoteNumber] = useState(existingQuotation?.quote_number ?? '')
  const [status, setStatus] = useState(existingQuotation?.status ?? 'draft')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function updateItem(index: number, key: keyof QuoteItem, value: string | number) {
    setItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [key]: value }
      if (key === 'qty' || key === 'rate') {
        updated[index].amount = (key === 'qty' ? Number(value) : updated[index].qty) *
                                (key === 'rate' ? Number(value) : updated[index].rate)
      }
      return updated
    })
  }

  function addItem() { setItems(prev => [...prev, { ...EMPTY_ITEM }]) }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }

  const subtotal = items.reduce((s, item) => s + item.amount, 0)
  const gstAmount = applyGst ? subtotal * (gstPercent / 100) : 0
  const total = subtotal + gstAmount

  async function save(newStatus?: string) {
    setSaving(true)
    const effectiveStatus = newStatus || status
    const payload = {
      event_id: eventId,
      items,
      subtotal,
      gst_percent: applyGst ? gstPercent : 0,
      gst_amount: gstAmount,
      total,
      validity_days: validity,
      notes: notes || null,
      status: effectiveStatus,
    }

    if (quoteId) {
      await supabase.from('quotations').update(payload).eq('id', quoteId)
    } else {
      const { data } = await supabase.from('quotations').insert({ ...payload }).select().single()
      if (data) {
        setQuoteId(data.id)
        setQuoteNumber(data.quote_number || `CEE/Q/${data.id.slice(0, 6).toUpperCase()}`)
      }
    }
    if (newStatus) setStatus(newStatus)
    setSaving(false)
    router.refresh()
  }

  const inputCls = "bg-transparent text-white text-sm focus:outline-none w-full placeholder-gray-600"
  const cellCls = "px-3 py-2.5 border-r border-gray-800"
  const qNum = quoteNumber || `CEE/Q/${eventId.slice(0, 6).toUpperCase()}`
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const validUntil = new Date(Date.now() + validity * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap print:hidden">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          status === 'draft' ? 'bg-gray-800 text-gray-400' :
          status === 'sent' ? 'bg-blue-900/50 text-blue-400' :
          status === 'accepted' ? 'bg-green-900/50 text-green-400' :
          'bg-red-900/50 text-red-400'
        }`}>{status.toUpperCase()}</span>
        <button onClick={() => save()} disabled={saving}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
          <Save size={14} /> {saving ? 'Saving...' : 'Save Draft'}
        </button>
        {status === 'draft' && (
          <button onClick={() => save('sent')} disabled={saving}
            className="flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-blue-400 text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
            <Send size={14} /> Mark as Sent
          </button>
        )}
        {status === 'sent' && (
          <>
            <button onClick={() => save('accepted')} disabled={saving}
              className="flex items-center gap-2 bg-green-950 hover:bg-green-900 text-green-400 text-sm px-4 py-2 rounded-xl transition-colors">
              Accepted
            </button>
            <button onClick={() => save('rejected')} disabled={saving}
              className="flex items-center gap-2 bg-red-950 hover:bg-red-900 text-red-400 text-sm px-4 py-2 rounded-xl transition-colors">
              Rejected
            </button>
          </>
        )}
        <button onClick={() => window.print()}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm px-4 py-2 rounded-xl transition-colors ml-auto">
          <Printer size={14} /> Print / PDF
        </button>
      </div>

      {/* Quotation Document */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl text-gray-900 print:shadow-none print:rounded-none">
        {/* Letterhead */}
        <div className="bg-gray-950 px-8 py-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                <span className="text-sm font-black text-black">CE</span>
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-tight">Creative Era Events</p>
                <p className="text-gray-400 text-xs">creativeeraevents@gmail.com · +91 86023 71023</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-amber-400 font-bold text-xl">QUOTATION</p>
            <p className="text-gray-400 text-xs mt-1">#{qNum}</p>
            <p className="text-gray-500 text-xs">Date: {today}</p>
            <p className="text-gray-500 text-xs">Valid until: {validUntil}</p>
          </div>
        </div>

        <div className="px-8 py-6">
          {/* For / Event */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Prepared For</p>
              <p className="font-semibold text-gray-900">{clientName || 'Client'}</p>
              {clientContact && <p className="text-gray-500 text-sm">{clientContact}</p>}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Event</p>
              <p className="font-semibold text-gray-900">{eventName}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
            <div className="grid grid-cols-[2fr_1fr_80px_100px_100px] bg-gray-100 text-xs text-gray-600 font-semibold uppercase tracking-wider">
              <div className={cellCls}>Description</div>
              <div className={cellCls}>Specs / Notes</div>
              <div className={cellCls}>Qty</div>
              <div className={cellCls}>Rate (₹)</div>
              <div className="px-3 py-2.5 text-right">Amount (₹)</div>
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_80px_100px_100px] border-t border-gray-200 items-center group">
                <div className={`${cellCls} relative`}>
                  <input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)}
                    placeholder="Item name..." className={inputCls} />
                  <button onClick={() => removeItem(i)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className={cellCls}>
                  <input value={item.specs} onChange={e => updateItem(i, 'specs', e.target.value)}
                    placeholder="Size, material..." className={inputCls} />
                </div>
                <div className={cellCls}>
                  <input type="number" value={item.qty} min="1" onChange={e => updateItem(i, 'qty', Number(e.target.value))}
                    className={inputCls} />
                </div>
                <div className={cellCls}>
                  <input type="number" value={item.rate} min="0" onChange={e => updateItem(i, 'rate', Number(e.target.value))}
                    className={inputCls} />
                </div>
                <div className="px-3 py-2.5 text-right text-sm font-medium text-gray-700">
                  {item.amount.toLocaleString('en-IN')}
                </div>
              </div>
            ))}
            {/* Add row */}
            <div className="border-t border-gray-200 print:hidden">
              <button onClick={addItem}
                className="flex items-center gap-2 text-xs text-amber-600 hover:text-amber-500 px-3 py-2.5 w-full transition-colors">
                <Plus size={12} /> Add Item
              </button>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between text-sm print:hidden">
                <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={applyGst} onChange={e => setApplyGst(e.target.checked)} className="rounded" />
                  GST
                  {applyGst && (
                    <input type="number" value={gstPercent} onChange={e => setGstPercent(Number(e.target.value))}
                      className="w-12 text-center border border-gray-300 rounded px-1 text-xs" />
                  )}
                  {applyGst && <span>%</span>}
                </label>
                <span>{applyGst ? `₹${gstAmount.toLocaleString('en-IN')}` : '—'}</span>
              </div>
              {applyGst && (
                <div className="flex justify-between text-sm print:flex hidden">
                  <span className="text-gray-600">GST ({gstPercent}%)</span>
                  <span>₹{gstAmount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-amber-600 text-lg">₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Notes & Validity */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Notes</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="Any terms, conditions, or notes for the client..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-amber-400 resize-none print:border-0 print:p-0" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Validity</p>
              <div className="flex items-center gap-2 print:hidden">
                <input type="number" value={validity} onChange={e => setValidity(Number(e.target.value))} min="1"
                  className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
                <span className="text-gray-600 text-sm">days</span>
              </div>
              <p className="text-gray-600 text-sm mt-1">Valid until {validUntil}</p>
            </div>
          </div>

          {/* T&C */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Terms & Conditions</p>
            <ol className="text-xs text-gray-500 space-y-1 list-decimal pl-4">
              <li>This quotation is valid for {validity} days from the date of issue.</li>
              <li>50% advance required to confirm booking. Balance before event day.</li>
              <li>Prices are subject to change if scope changes after confirmation.</li>
              <li>Creative Era Events reserves the right to revise quote if site conditions differ.</li>
              <li>GST applicable as per prevailing government rates.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 flex items-center justify-between border-t border-gray-200">
          <p className="text-xs text-gray-400">Creative Era Events · creativeeraevents@gmail.com · +91 86023 71023</p>
          <p className="text-xs text-gray-400">#{qNum}</p>
        </div>
      </div>
    </div>
  )
}
