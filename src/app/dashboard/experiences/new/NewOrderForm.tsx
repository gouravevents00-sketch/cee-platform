'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { EXPERIENCE_SERVICES, ServiceType } from '@/lib/types'
import { Zap, PenLine, Bot, Layers, Plus, X, ShoppingCart } from 'lucide-react'

const SERVICE_ICONS: Record<ServiceType, React.ElementType> = {
  laser: Zap,
  sketch: PenLine,
  robo_arm: Bot,
  '3d_print': Layers,
}

interface CartItem {
  service_type: ServiceType
  package_name: string
  pieces_included: number | null
  extra_pieces: number
  amount: number
}

export default function NewOrderForm({ userId }: { userId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselected = searchParams.get('service') as ServiceType | null

  const [cart, setCart] = useState<CartItem[]>(() => {
    if (!preselected) return []
    const svc = EXPERIENCE_SERVICES.find(s => s.id === preselected)
    if (!svc) return []
    const pkg = svc.packages[0]
    return [{
      service_type: preselected,
      package_name: pkg.name,
      pieces_included: pkg.pieces,
      extra_pieces: 0,
      amount: pkg.price,
    }]
  })

  const [expandedService, setExpandedService] = useState<ServiceType | null>(preselected ? null : null)
  const [clientName, setClientName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventCity, setEventCity] = useState('')
  const [specialNotes, setSpecialNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalAmount = cart.reduce((sum, item) => sum + item.amount, 0)
  const inCart = (serviceType: ServiceType) => cart.some(c => c.service_type === serviceType)

  function addToCart(serviceType: ServiceType) {
    const svc = EXPERIENCE_SERVICES.find(s => s.id === serviceType)!
    const pkg = svc.packages[0]
    setCart(prev => [...prev, {
      service_type: serviceType,
      package_name: pkg.name,
      pieces_included: pkg.pieces,
      extra_pieces: 0,
      amount: pkg.price,
    }])
    setExpandedService(null)
  }

  function removeFromCart(serviceType: ServiceType) {
    setCart(prev => prev.filter(c => c.service_type !== serviceType))
  }

  function updateCartItem(serviceType: ServiceType, updates: Partial<CartItem>) {
    setCart(prev => prev.map(c => {
      if (c.service_type !== serviceType) return c
      const updated = { ...c, ...updates }
      // recalculate amount
      const svc = EXPERIENCE_SERVICES.find(s => s.id === serviceType)!
      const pkg = svc.packages.find(p => p.name === updated.package_name)!
      updated.amount = pkg.price + (svc.extra_piece_rate || 0) * updated.extra_pieces
      updated.pieces_included = pkg.pieces
      return updated
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (cart.length === 0) { setError('Kam se kam ek service select karo'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/experiences/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // primary service (first item, for backward compat)
          service_type: cart[0].service_type,
          package_name: cart[0].package_name,
          pieces_included: cart[0].pieces_included,
          extra_pieces: cart[0].extra_pieces,
          // all items
          items: cart,
          client_name: clientName,
          contact_name: contactName,
          contact_phone: contactPhone,
          event_name: eventName,
          event_date: eventDate,
          event_city: eventCity,
          special_notes: specialNotes || null,
          total_amount: totalAmount,
          created_by: userId,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to create order')
      }
      const { id } = await res.json()
      router.push(`/dashboard/experiences/orders/${id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Service Catalog */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-3">Services</h2>
        <div className="space-y-2">
          {EXPERIENCE_SERVICES.map(s => {
            const Icon = SERVICE_ICONS[s.id]
            const added = inCart(s.id)
            const expanded = expandedService === s.id

            return (
              <div key={s.id} className={`rounded-xl border transition-colors ${added ? 'border-amber-500/40 bg-amber-500/5' : 'border-gray-800'}`}>
                {/* Service Row */}
                <div className="flex items-center gap-3 p-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${added ? 'text-amber-400' : 'text-white'}`}>
                      {s.name.replace(' Station', '').replace(' Interactive Demo', '')}
                    </p>
                    <p className="text-gray-600 text-xs">
                      From ₹{s.packages[0].price.toLocaleString('en-IN')}
                    </p>
                  </div>
                  {added ? (
                    <button type="button" onClick={() => removeFromCart(s.id)}
                      className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      <X size={12} /> Remove
                    </button>
                  ) : (
                    <button type="button"
                      onClick={() => setExpandedService(expanded ? null : s.id)}
                      className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      <Plus size={12} /> Add
                    </button>
                  )}
                </div>

                {/* Package Picker (expanded) */}
                {expanded && !added && (
                  <div className="px-3 pb-3 space-y-2 border-t border-gray-800 pt-3">
                    {s.packages.map(pkg => (
                      <button key={pkg.name} type="button"
                        onClick={() => {
                          const svc = EXPERIENCE_SERVICES.find(x => x.id === s.id)!
                          setCart(prev => [...prev, {
                            service_type: s.id,
                            package_name: pkg.name,
                            pieces_included: pkg.pieces,
                            extra_pieces: 0,
                            amount: pkg.price,
                          }])
                          setExpandedService(null)
                        }}
                        className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded-xl px-3 py-2.5 transition-colors text-left">
                        <div>
                          <span className="text-white text-sm font-medium">{pkg.name}</span>
                          <span className="text-gray-500 text-xs ml-2">{pkg.duration}</span>
                          {pkg.pieces && <span className="text-gray-600 text-xs ml-2">· {pkg.pieces} pcs</span>}
                        </div>
                        <span className="text-amber-400 text-sm font-semibold">₹{pkg.price.toLocaleString('en-IN')}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Cart Item Controls (when added) */}
                {added && (() => {
                  const cartItem = cart.find(c => c.service_type === s.id)!
                  return (
                    <div className="px-3 pb-3 border-t border-amber-500/20 pt-3 space-y-2">
                      {/* Package select */}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-16">Package</span>
                        <select value={cartItem.package_name}
                          onChange={e => updateCartItem(s.id, { package_name: e.target.value })}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500">
                          {s.packages.map(p => (
                            <option key={p.name} value={p.name}>
                              {p.name} — {p.duration}{p.pieces ? ` · ${p.pieces} pcs` : ''} — ₹{p.price.toLocaleString('en-IN')}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* Extra pieces */}
                      {s.extra_piece_rate && cartItem.pieces_included && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs w-16">Extra pcs</span>
                          <input type="number" min={0} value={cartItem.extra_pieces}
                            onChange={e => updateCartItem(s.id, { extra_pieces: parseInt(e.target.value) || 0 })}
                            className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500" />
                          <span className="text-gray-600 text-xs">× ₹{s.extra_piece_rate}/pc</span>
                        </div>
                      )}
                      <div className="flex justify-end">
                        <span className="text-amber-400 text-sm font-semibold">₹{cartItem.amount.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      </div>

      {/* Cart Summary */}
      {cart.length > 0 && (
        <div className="bg-gray-900 border border-amber-500/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart size={15} className="text-amber-400" />
            <h2 className="text-white font-semibold">Booking Summary</h2>
            <span className="text-amber-500 text-xs font-medium bg-amber-500/10 px-2 py-0.5 rounded-full">{cart.length} service{cart.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2 mb-3">
            {cart.map(item => {
              const svc = EXPERIENCE_SERVICES.find(s => s.id === item.service_type)!
              return (
                <div key={item.service_type} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{svc.name.replace(' Station', '').replace(' Interactive Demo', '')} · {item.package_name}</span>
                  <span className="text-white font-medium">₹{item.amount.toLocaleString('en-IN')}</span>
                </div>
              )
            })}
          </div>
          <div className="border-t border-gray-800 pt-3 flex items-center justify-between">
            <span className="text-gray-400 text-sm">Total</span>
            <span className="text-amber-400 text-xl font-bold">₹{totalAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      {/* Event & Client Details */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-4">Event & Client Details</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Client / Company *</label>
              <input required type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                placeholder="Eg. HDFC Bank"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Event Name *</label>
              <input required type="text" value={eventName} onChange={e => setEventName(e.target.value)}
                placeholder="Eg. Annual Day 2025"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Event Date *</label>
              <input required type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">City *</label>
              <input required type="text" value={eventCity} onChange={e => setEventCity(e.target.value)}
                placeholder="Eg. Mumbai"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Contact Person *</label>
              <input required type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                placeholder="Name"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Contact Phone *</label>
              <input required type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1.5">Special Notes</label>
            <textarea value={specialNotes} onChange={e => setSpecialNotes(e.target.value)}
              placeholder="Any specific requirements, branding, materials..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600 resize-none" />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="flex items-center gap-3 pb-6">
        <button type="button" onClick={() => router.back()}
          className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-xl text-sm transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={loading || cart.length === 0}
          className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-xl text-sm transition-colors">
          {loading ? 'Creating...' : `Confirm Booking${cart.length > 1 ? ` (${cart.length} services)` : ''}`}
        </button>
      </div>
    </form>
  )
}
