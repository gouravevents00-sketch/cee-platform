'use client'

import { useState } from 'react'
import { CalendarDays, MapPin, CheckCircle2, Clock, IndianRupee, Upload, Check } from 'lucide-react'

interface Props {
  event: any
  vendor: any
  elements: any[]
  payment: any
  token: string
}

const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

export default function VendorPortalView({ event, vendor, elements, payment, token }: Props) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [acknowledging, setAcknowledging] = useState(false)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [invoiceUploaded, setInvoiceUploaded] = useState(false)

  const total = elements.reduce((s, el) => s + ((el.vendor_rate || 0) * el.quantity), 0)
  const soNumber = `CEE/SO/${event?.id?.slice(0, 6).toUpperCase()}/${vendor?.id?.slice(0, 4).toUpperCase()}`

  async function acknowledge() {
    setAcknowledging(true)
    await fetch('/api/portal/vendor/acknowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    setAcknowledged(true)
    setAcknowledging(false)
  }

  async function uploadInvoice() {
    if (!invoiceFile) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', invoiceFile)
    formData.append('token', token)
    await fetch('/api/portal/vendor/invoice', { method: 'POST', body: formData })
    setInvoiceUploaded(true)
    setUploading(false)
  }

  return (
    <div className="space-y-4 py-2">
      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-gray-500 text-xs mb-1">Service Order · {soNumber}</p>
            <h1 className="text-white text-xl font-bold">{event?.name}</h1>
            {event?.clients?.name && <p className="text-amber-400 text-sm mt-0.5">Client: {event.clients.name}</p>}
          </div>
          <div className="text-right text-xs text-gray-600">
            <p>Date: {today}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-gray-400">
          {event?.event_date && (
            <span className="flex items-center gap-1.5">
              <CalendarDays size={13} />
              {new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          )}
          {event?.venue && (
            <span className="flex items-center gap-1.5">
              <MapPin size={13} /> {event.venue}{event.city ? `, ${event.city}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Vendor Info + Acknowledge */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <p className="text-gray-500 text-xs mb-1 uppercase tracking-wider font-medium">Issued To</p>
        <p className="text-white font-semibold">{vendor?.name}</p>
        {vendor?.contact_name && <p className="text-gray-400 text-sm">{vendor.contact_name}</p>}
        {vendor?.category && <p className="text-gray-500 text-xs capitalize mt-0.5">{vendor.category}</p>}

        <div className="mt-4 pt-4 border-t border-gray-800">
          {acknowledged ? (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle2 size={16} /> Service Order acknowledged
            </div>
          ) : (
            <button
              onClick={acknowledge}
              disabled={acknowledging}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {acknowledging ? 'Submitting...' : 'Acknowledge & Accept Service Order'}
            </button>
          )}
        </div>
      </div>

      {/* Scope of Work */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold text-sm">Scope of Work</h2>
          <p className="text-gray-500 text-xs mt-0.5">{elements.length} items assigned to you</p>
        </div>

        {elements.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">No items assigned yet</p>
        ) : (
          <>
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-5 py-2 text-xs text-gray-600 uppercase tracking-wider font-medium bg-gray-800/50">
              <span>Item</span><span>Size</span><span>Qty</span><span className="text-right">Amount</span>
            </div>
            {elements.map(el => (
              <div key={el.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-5 py-3 border-t border-gray-800 items-start">
                <div>
                  <p className="text-white text-sm font-medium">{el.name}</p>
                  {el.specs && <p className="text-gray-500 text-xs">{el.specs}</p>}
                  {el.material && <p className="text-gray-600 text-xs">{el.material}</p>}
                  {el.notes && <p className="text-gray-600 text-xs italic">{el.notes}</p>}
                </div>
                <span className="text-gray-400 text-xs pt-0.5">{el.size || '—'}</span>
                <span className="text-gray-300 text-sm">{el.quantity}</span>
                <span className="text-gray-300 text-sm text-right">
                  {el.vendor_rate ? `₹${(el.vendor_rate * el.quantity).toLocaleString('en-IN')}` : '—'}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-800/50 border-t border-gray-800">
              <span className="text-gray-400 text-sm font-semibold">Total</span>
              <span className="text-amber-400 font-bold">₹{total.toLocaleString('en-IN')}</span>
            </div>
          </>
        )}
      </div>

      {/* Terms */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold text-sm mb-3">Terms & Conditions</h2>
        <ol className="text-xs text-gray-500 space-y-1.5 list-decimal pl-4">
          <li>Scope is limited to items listed above. Additional work requires a separate order.</li>
          <li>All work must meet agreed quality and specifications. Deviations require prior approval.</li>
          <li>Payment will be released post-event upon satisfactory completion and invoice submission.</li>
          <li>Vendor is responsible for timely delivery and professional on-ground execution.</li>
          <li>Creative Era Events reserves the right to reject substandard work without payment liability.</li>
        </ol>
      </div>

      {/* Payment Status */}
      {payment && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <IndianRupee size={16} className="text-amber-500" />
            <h2 className="text-white font-semibold text-sm">Your Payment</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-lg">₹{payment.amount.toLocaleString('en-IN')}</p>
              {payment.due_date && payment.status !== 'paid' && (
                <p className="text-gray-500 text-xs">Expected: {new Date(payment.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              )}
              {payment.paid_date && (
                <p className="text-gray-500 text-xs">Paid: {new Date(payment.paid_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              )}
              {payment.notes && <p className="text-gray-600 text-xs mt-0.5">{payment.notes}</p>}
            </div>
            <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
              payment.status === 'paid' ? 'bg-green-900/50 text-green-400' :
              payment.status === 'overdue' ? 'bg-red-900/50 text-red-400' :
              'bg-gray-800 text-gray-400'
            }`}>
              {payment.status === 'paid' ? '✓ Paid' : payment.status === 'overdue' ? 'Overdue' : 'Pending'}
            </span>
          </div>
        </div>
      )}

      {/* Invoice Upload */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Upload size={16} className="text-amber-500" />
          <h2 className="text-white font-semibold text-sm">Submit Invoice</h2>
        </div>
        {invoiceUploaded ? (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Check size={15} /> Invoice submitted successfully
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setInvoiceFile(e.target.files?.[0] || null)}
              className="w-full bg-gray-800 border border-gray-700 text-gray-400 rounded-xl px-4 py-2.5 text-sm file:mr-3 file:bg-gray-700 file:text-gray-300 file:border-0 file:rounded-lg file:px-3 file:py-1 file:text-xs"
            />
            <button
              onClick={uploadInvoice}
              disabled={!invoiceFile || uploading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload Invoice'}
            </button>
            <p className="text-gray-600 text-xs">Accepted: PDF, JPG, PNG</p>
          </div>
        )}
      </div>

      <p className="text-gray-700 text-xs text-center py-2">
        For queries: +91 86023 71023 · creativeeraevents@gmail.com
      </p>
    </div>
  )
}
