'use client'

import { useState } from 'react'
import { Printer, FileText, ChevronDown } from 'lucide-react'

interface Element {
  id: string
  name: string
  specs?: string
  size?: string
  quantity: number
  material?: string
  vendor_id?: string
  vendor_rate?: number
  notes?: string
  vendors?: { id: string; name: string; contact_name?: string; contact_phone?: string; category?: string }
}

interface Event {
  id: string
  name: string
  event_date?: string
  venue?: string
  city?: string
  clients?: { name: string }
}

interface Props {
  event: Event
  elements: Element[]
  vendors: { id: string; name: string; contact_name?: string; contact_phone?: string; category?: string }[]
}

const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

export default function SOGenerator({ event, elements, vendors }: Props) {
  const [selectedVendor, setSelectedVendor] = useState<string>(vendors[0]?.id || '')

  const vendor = vendors.find(v => v.id === selectedVendor)
  const vendorElements = elements.filter(el => el.vendor_id === selectedVendor)

  const total = vendorElements.reduce((s, el) => s + ((el.vendor_rate || 0) * el.quantity), 0)
  const soNumber = `CEE/SO/${event.id.slice(0, 6).toUpperCase()}/${selectedVendor.slice(0, 4).toUpperCase()}`

  const eventDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'To be confirmed'

  if (vendors.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
        <FileText size={28} className="text-gray-700 mx-auto mb-3" />
        <p className="text-gray-500">No vendors assigned to elements yet</p>
        <p className="text-gray-600 text-xs mt-1">Add elements with vendor assignments first</p>
      </div>
    )
  }

  return (
    <div>
      {/* Vendor Selector */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5 print:hidden">
        <label className="block text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Select Vendor</label>
        <div className="relative">
          <select
            value={selectedVendor}
            onChange={e => setSelectedVendor(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 appearance-none pr-8"
          >
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name}{v.category ? ` — ${v.category}` : ''}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        {vendor && (
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            {vendor.contact_name && <span>{vendor.contact_name}</span>}
            {vendor.contact_phone && <span>{vendor.contact_phone}</span>}
            <span className="capitalize">{vendor.category || 'Vendor'}</span>
          </div>
        )}
        <div className="mt-4 flex justify-between items-center">
          <p className="text-gray-500 text-sm">{vendorElements.length} item{vendorElements.length !== 1 ? 's' : ''} assigned</p>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            <Printer size={15} /> Print SO
          </button>
        </div>
      </div>

      {/* SO Document */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl print:shadow-none print:rounded-none">
        {/* Header */}
        <div className="bg-gray-950 text-white px-8 py-6 print:bg-black">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-black text-black">CE</span>
                </div>
                <div>
                  <p className="font-bold text-lg leading-tight">Creative Era Events</p>
                  <p className="text-gray-400 text-xs">creativeeraevents.com</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-amber-500 font-bold text-lg">SERVICE ORDER</p>
              <p className="text-gray-400 text-xs mt-1">{soNumber}</p>
              <p className="text-gray-400 text-xs">Date: {today}</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6">
          {/* Event + Vendor Info */}
          <div className="grid grid-cols-2 gap-6 mb-6 pb-6 border-b border-gray-200">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Event Details</p>
              <p className="text-gray-900 font-semibold text-base">{event.name}</p>
              {event.clients?.name && <p className="text-gray-600 text-sm">Client: {event.clients.name}</p>}
              {event.venue && <p className="text-gray-600 text-sm">Venue: {event.venue}{event.city ? `, ${event.city}` : ''}</p>}
              <p className="text-gray-600 text-sm">Date: {eventDate}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Vendor Details</p>
              <p className="text-gray-900 font-semibold text-base">{vendor?.name}</p>
              {vendor?.contact_name && <p className="text-gray-600 text-sm">Contact: {vendor.contact_name}</p>}
              {vendor?.contact_phone && <p className="text-gray-600 text-sm">Phone: {vendor.contact_phone}</p>}
              {vendor?.category && <p className="text-gray-600 text-sm capitalize">Category: {vendor.category}</p>}
            </div>
          </div>

          {/* Scope of Work */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Scope of Work</p>

          {vendorElements.length === 0 ? (
            <div className="py-8 text-center border border-gray-200 rounded-xl">
              <p className="text-gray-400 text-sm">No elements assigned to this vendor</p>
            </div>
          ) : (
            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider rounded-tl-xl">Item</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Size / Specs</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate (₹)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider rounded-tr-xl">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendorElements.map((el, i) => (
                  <tr key={el.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{el.name}</p>
                      {el.material && <p className="text-gray-500 text-xs">{el.material}</p>}
                      {el.notes && <p className="text-gray-400 text-xs italic">{el.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {[el.size, el.specs].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{el.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {el.vendor_rate ? el.vendor_rate.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {el.vendor_rate ? ((el.vendor_rate * el.quantity).toLocaleString('en-IN')) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-900 text-white">
                  <td colSpan={4} className="px-4 py-3 font-semibold text-right rounded-bl-xl">Total Amount</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-400 rounded-br-xl">₹{total.toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* T&C */}
          <div className="border border-gray-200 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Terms & Conditions</p>
            <ol className="text-xs text-gray-600 space-y-1 list-decimal pl-4">
              <li>The scope of work is limited to what is specified above. Any additions will require a separate order.</li>
              <li>All work must meet the quality and specifications agreed upon. Deviations require prior approval.</li>
              <li>Payment will be released post-event upon satisfactory completion and submission of final invoice.</li>
              <li>Vendor is responsible for material quality, timely delivery, and professional execution at the venue.</li>
              <li>Creative Era Events reserves the right to reject substandard work without payment liability.</li>
            </ol>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 mt-8">
            <div>
              <div className="h-12 border-b border-gray-300 mb-2" />
              <p className="text-xs text-gray-500">For Creative Era Events</p>
              <p className="text-xs font-medium text-gray-700">Authorised Signatory</p>
            </div>
            <div>
              <div className="h-12 border-b border-gray-300 mb-2" />
              <p className="text-xs text-gray-500">For {vendor?.name || 'Vendor'}</p>
              <p className="text-xs font-medium text-gray-700">Accepted with Stamp & Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
