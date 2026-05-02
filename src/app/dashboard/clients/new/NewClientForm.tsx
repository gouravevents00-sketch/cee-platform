'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NewClientForm() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    type: 'corporate',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    advance_percent: '50',
    credit_period_days: '30',
    work_order_number: '',
    notes: '',
  })

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.from('clients').insert({
      ...form,
      advance_percent: parseInt(form.advance_percent),
      credit_period_days: parseInt(form.credit_period_days),
      work_order_number: form.work_order_number || null,
    })

    if (error) {
      setError('Failed to add client. Please try again.')
      setLoading(false)
      return
    }

    router.push('/dashboard/clients')
    router.refresh()
  }

  const inputClass = "w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition-colors placeholder-gray-600"
  const labelClass = "block text-sm text-gray-400 mb-1.5"

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Basic Info */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-semibold text-sm">Client Details</h2>
        <div>
          <label className={labelClass}>Client / Company Name *</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required className={inputClass} placeholder="e.g. Altus Group, IOCL" />
        </div>
        <div>
          <label className={labelClass}>Client Type *</label>
          <select value={form.type} onChange={e => set('type', e.target.value)} className={inputClass}>
            <option value="agency">Agency</option>
            <option value="corporate">Corporate</option>
            <option value="government">Government</option>
            <option value="individual">Individual</option>
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
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} className={inputClass} placeholder="client@company.com" />
        </div>
      </div>

      {/* Payment Terms */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-semibold text-sm">Payment Terms</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Advance %</label>
            <input type="number" value={form.advance_percent} onChange={e => set('advance_percent', e.target.value)} min="0" max="100" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Credit Period (days)</label>
            <input type="number" value={form.credit_period_days} onChange={e => set('credit_period_days', e.target.value)} min="0" className={inputClass} />
          </div>
        </div>
        {form.type === 'government' && (
          <div>
            <label className={labelClass}>Work Order Number</label>
            <input type="text" value={form.work_order_number} onChange={e => set('work_order_number', e.target.value)} className={inputClass} placeholder="WO/2025/001" />
          </div>
        )}
        <div>
          <label className={labelClass}>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className={inputClass} placeholder="Any special payment conditions or notes..." />
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-900 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium px-4 py-3 rounded-xl text-sm transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold px-4 py-3 rounded-xl text-sm transition-colors">
          {loading ? 'Saving...' : 'Add Client'}
        </button>
      </div>
    </form>
  )
}
