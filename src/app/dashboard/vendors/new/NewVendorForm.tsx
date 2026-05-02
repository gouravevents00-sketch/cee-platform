'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'

export default function NewVendorForm() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', category: 'printing', contact_name: '',
    contact_phone: '', reliability_score: 3, notes: '',
  })

  function set(key: string, value: string | number) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('vendors').insert(form)
    router.push('/dashboard/vendors')
    router.refresh()
  }

  const inputClass = "w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition-colors placeholder-gray-600"
  const labelClass = "block text-sm text-gray-400 mb-1.5"

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div>
          <label className={labelClass}>Vendor / Company Name *</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required className={inputClass} placeholder="e.g. Sharma Printers, ABC Fabricators" />
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)} className={inputClass}>
            <option value="printing">Printing</option>
            <option value="fabrication">Fabrication</option>
            <option value="av">AV / Sound / LED</option>
            <option value="lighting">Lighting</option>
            <option value="manpower">Manpower</option>
            <option value="transport">Transport</option>
            <option value="catering">Catering</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Contact Person</label>
            <input type="text" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className={inputClass} placeholder="Name" />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className={inputClass} placeholder="+91 98765 43210" />
          </div>
        </div>

        {/* Reliability Rating */}
        <div>
          <label className={labelClass}>Reliability Rating</label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onClick={() => set('reliability_score', star)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  size={24}
                  className={star <= form.reliability_score ? 'text-amber-400 fill-amber-400' : 'text-gray-700 hover:text-gray-500'}
                />
              </button>
            ))}
            <span className="text-gray-500 text-sm ml-1">{form.reliability_score}/5</span>
          </div>
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className={inputClass} placeholder="Any special notes about this vendor..." />
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium px-4 py-3 rounded-xl text-sm transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold px-4 py-3 rounded-xl text-sm transition-colors">
          {loading ? 'Saving...' : 'Add Vendor'}
        </button>
      </div>
    </form>
  )
}
