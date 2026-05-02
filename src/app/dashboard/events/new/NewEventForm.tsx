'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Template {
  id: string
  name: string
  event_type?: string
  venue?: string
  city?: string
  notes?: string
}

interface Props {
  clients: { id: string; name: string; type: string }[]
  pocs: { id: string; name: string; role: string }[]
  templates: Template[]
}

export default function NewEventForm({ clients, pocs, templates }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    client_id: '',
    event_date: '',
    venue: '',
    city: '',
    type: '',
    poc_id: '',
    notes: '',
    status: 'enquiry',
  })

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      ...form,
      client_id: form.client_id || null,
      poc_id: form.poc_id || null,
      event_date: form.event_date || null,
      created_by: user.id,
      current_phase: 0,
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert(payload)
      .select()
      .single()

    if (eventError) {
      setError('Failed to create event. Please try again.')
      setLoading(false)
      return
    }

    // Create all 30 tasks automatically
    const { error: taskError } = await supabase.rpc('create_event_tasks', { p_event_id: event.id })

    if (taskError) {
      console.error('Failed to create tasks:', taskError)
    }

    // Log activity
    await supabase.from('activity_log').insert({
      event_id: event.id,
      user_id: user.id,
      action: 'Event Created',
      detail: `${form.name} event create kiya gaya`,
    })

    router.push(`/dashboard/events/${event.id}`)
    router.refresh()
  }

  const inputClass = "w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition-colors placeholder-gray-600"
  const labelClass = "block text-sm text-gray-400 mb-1.5"

  function applyTemplate(templateId: string) {
    const t = templates.find(t => t.id === templateId)
    if (!t) return
    setForm(f => ({
      ...f,
      type: t.event_type || f.type,
      venue: t.venue || f.venue,
      city: t.city || f.city,
      notes: t.notes || f.notes,
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Template selector */}
      {templates.length > 0 && (
        <div className="bg-gray-900 border border-amber-700/30 rounded-2xl p-4">
          <label className="block text-xs text-amber-400 font-medium mb-2 uppercase tracking-wide">Start from a template</label>
          <select
            defaultValue=""
            onChange={e => applyTemplate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition-colors"
          >
            <option value="">Choose template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <p className="text-gray-600 text-xs mt-1.5">Pre-fills: event type, venue, city, notes</p>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-semibold text-sm">Event Details</h2>

        <div>
          <label className={labelClass}>Event Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            required
            className={inputClass}
            placeholder="e.g. Altus Annual Day Indore 2025"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Event Date</label>
            <input
              type="date"
              value={form.event_date}
              onChange={e => set('event_date', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Event Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} className={inputClass}>
              <option value="">Select...</option>
              <option value="corporate">Corporate Event</option>
              <option value="wedding">Wedding</option>
              <option value="birthday">Birthday / Social</option>
              <option value="exhibition">Exhibition / Expo</option>
              <option value="government">Government Event</option>
              <option value="product_launch">Product Launch</option>
              <option value="conference">Conference / Summit</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Venue</label>
            <input
              type="text"
              value={form.venue}
              onChange={e => set('venue', e.target.value)}
              className={inputClass}
              placeholder="Venue naam"
            />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input
              type="text"
              value={form.city}
              onChange={e => set('city', e.target.value)}
              className={inputClass}
              placeholder="e.g. Indore"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-semibold text-sm">Client & Team</h2>

        <div>
          <label className={labelClass}>Client</label>
          <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inputClass}>
            <option value="">Select client...</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>POC (Point of Contact)</label>
          <select value={form.poc_id} onChange={e => set('poc_id', e.target.value)} className={inputClass}>
            <option value="">Assign POC...</option>
            {pocs.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className={inputClass}>
            <option value="enquiry">Enquiry</option>
            <option value="active">Active (Confirmed)</option>
          </select>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <label className={labelClass}>Notes / Special Instructions</label>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          className={inputClass}
          placeholder="Any special instructions or notes..."
        />
      </div>

      {error && (
        <div className="bg-red-950 border border-red-900 text-red-400 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium px-4 py-3 rounded-xl text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold px-4 py-3 rounded-xl text-sm transition-colors"
        >
          {loading ? 'Creating event...' : 'Create Event & Setup Tasks'}
        </button>
      </div>
    </form>
  )
}
