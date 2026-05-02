'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PRODUCTION_SERVICES, ProductionServiceType } from '@/lib/types'
import { Hammer, Megaphone, Store, Wand2, FileImage, Check } from 'lucide-react'

const SERVICE_ICONS: Record<ProductionServiceType, React.ElementType> = {
  stage: Hammer,
  branding: Megaphone,
  stall: Store,
  decor: Wand2,
  signage: FileImage,
}

export default function NewBriefForm({ userId }: { userId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselected = searchParams.get('service') as ProductionServiceType | null

  const [selectedTypes, setSelectedTypes] = useState<ProductionServiceType[]>(
    preselected ? [preselected] : []
  )

  function toggleService(type: ProductionServiceType) {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }
  const [clientName, setClientName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventCity, setEventCity] = useState('')
  const [brief, setBrief] = useState('')
  const [dimensions, setDimensions] = useState('')
  const [materialPref, setMaterialPref] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedTypes.length === 0) { setError('Kam se kam ek service select karo'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/production/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_type: selectedTypes[0],        // primary (backward compat)
          service_types: selectedTypes,           // all selected
          client_name: clientName,
          contact_name: contactName,
          contact_phone: contactPhone,
          event_name: eventName,
          event_date: eventDate || null,
          event_city: eventCity,
          brief,
          dimensions: dimensions || null,
          material_preference: materialPref || null,
          created_by: userId,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to submit brief')
      }
      const { id } = await res.json()
      router.push(`/dashboard/production/projects/${id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Service Selection — multi-select */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">Service Types</h2>
          <span className="text-gray-500 text-xs">Multiple select kar sakte hain</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PRODUCTION_SERVICES.map(s => {
            const Icon = SERVICE_ICONS[s.id]
            const selected = selectedTypes.includes(s.id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleService(s.id)}
                className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${
                  selected ? 'border-amber-500 bg-amber-500/10' : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
                  <Icon size={13} />
                </div>
                <span className={`text-xs font-medium leading-tight flex-1 ${selected ? 'text-amber-400' : 'text-gray-300'}`}>
                  {s.name}
                </span>
                {selected && <Check size={12} className="text-amber-400 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
        {selectedTypes.length > 1 && (
          <p className="text-amber-500/70 text-xs mt-3">
            {selectedTypes.length} services selected — ek hi brief mein submit honge
          </p>
        )}
      </div>

      {/* Client & Event */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-4">Client & Event Details</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Client / Company *</label>
              <input required type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                placeholder="Eg. Reliance Industries"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Event / Project Name *</label>
              <input required type="text" value={eventName} onChange={e => setEventName(e.target.value)}
                placeholder="Eg. Annual Conference 2025"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Event Date</label>
              <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">City *</label>
              <input required type="text" value={eventCity} onChange={e => setEventCity(e.target.value)}
                placeholder="Eg. Delhi"
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
        </div>
      </div>

      {/* Project Brief */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-4">Project Brief</h2>
        <div className="space-y-3">
          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1.5">Brief / Requirements *</label>
            <textarea required value={brief} onChange={e => setBrief(e.target.value)}
              placeholder="Describe what you need — type of structure, design references, finish, any special requirements..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Dimensions / Size</label>
              <input type="text" value={dimensions} onChange={e => setDimensions(e.target.value)}
                placeholder="Eg. 20ft x 10ft x 8ft"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Material Preference</label>
              <input type="text" value={materialPref} onChange={e => setMaterialPref(e.target.value)}
                placeholder="Eg. MDF + fabric, Iron truss"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>
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
        <button type="submit" disabled={loading || selectedTypes.length === 0}
          className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-xl text-sm transition-colors">
          {loading ? 'Submitting...' : `Submit Brief${selectedTypes.length > 1 ? ` (${selectedTypes.length} services)` : ''}`}
        </button>
      </div>
    </form>
  )
}
