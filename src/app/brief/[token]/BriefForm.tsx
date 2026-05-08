'use client'

import { useState, useRef } from 'react'
import { Upload, Plus, Trash2, Send, CheckCircle2, Paperclip, X } from 'lucide-react'

interface Prefill {
  clientName: string
  clientPhone: string
  clientEmail: string
  eventType: string
  eventDate: string
  city: string
}

const EVENT_TYPES = [
  'Corporate Conference', 'Product Launch', 'Award Ceremony', 'Annual Day',
  'Exhibition / Expo', 'Wedding', 'Social Celebration', 'Government Event',
  'Seminar / Workshop', 'Brand Activation', 'Other',
]

export default function BriefForm({ token, prefill }: { token: string; prefill: Prefill }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Step 1 — Contact & Event Info
  const [clientName, setClientName] = useState(prefill.clientName)
  const [clientPhone, setClientPhone] = useState(prefill.clientPhone)
  const [clientEmail, setClientEmail] = useState(prefill.clientEmail)
  const [orgName, setOrgName] = useState('')
  const [eventType, setEventType] = useState(prefill.eventType)
  const [eventDate, setEventDate] = useState(prefill.eventDate)
  const [city, setCity] = useState(prefill.city)
  const [venue, setVenue] = useState('')
  const [pax, setPax] = useState('')
  const [budget, setBudget] = useState('')

  // Step 2 — Requirements
  const [requirements, setRequirements] = useState('')
  const [elements, setElements] = useState<{ name: string; spec: string; qty: string }[]>([
    { name: '', spec: '', qty: '1' }
  ])
  const [inputMode, setInputMode] = useState<'text' | 'list'>('text')

  // Step 3 — Upload
  const [file, setFile] = useState<File | null>(null)
  const [extraNotes, setExtraNotes] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function addElement() {
    setElements(prev => [...prev, { name: '', spec: '', qty: '1' }])
  }
  function removeElement(i: number) {
    setElements(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateElement(i: number, field: string, value: string) {
    setElements(prev => prev.map((el, idx) => idx === i ? { ...el, [field]: value } : el))
  }

  async function handleSubmit() {
    if (!clientName.trim() || !clientPhone.trim()) {
      setError('Name and phone are required.')
      return
    }
    setSubmitting(true)
    setError('')

    const briefData = {
      client_name: clientName,
      client_phone: clientPhone,
      client_email: clientEmail,
      org_name: orgName,
      event_type: eventType,
      event_date: eventDate,
      city,
      venue,
      pax_count: pax,
      budget_range: budget,
      requirements: inputMode === 'text' ? requirements : undefined,
      elements: inputMode === 'list' ? elements.filter(e => e.name.trim()) : undefined,
      extra_notes: extraNotes,
    }

    try {
      let res: Response
      if (file) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('brief_data', JSON.stringify(briefData))
        res = await fetch(`/api/brief/${token}`, { method: 'POST', body: formData })
      } else {
        res = await fetch(`/api/brief/${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(briefData),
        })
      }

      if (res.ok) {
        setSubmitted(true)
      } else {
        const d = await res.json()
        setError(d.error || 'Submission failed. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-900/40 border border-green-800/50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={28} className="text-green-400" />
          </div>
          <h1 className="text-white text-xl font-bold mb-2">Brief Submitted!</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Thank you, {clientName}. We've received your event brief and will review it shortly.
            Our team will reach out to you on <span className="text-white">{clientPhone}</span>.
          </p>
          <div className="mt-6 p-4 bg-gray-900 border border-gray-800 rounded-2xl text-left">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">What happens next</p>
            <div className="space-y-1.5">
              {['We review your requirements', 'We prepare a detailed quotation', 'We share it with you for review'].map((s, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-gray-400">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center flex-shrink-0 font-bold">{i + 1}</span>
                  {s}
                </div>
              ))}
            </div>
          </div>
          <p className="text-gray-600 text-xs mt-6">Creative Era Events · +91 86023 71023 · creativeeraevents@gmail.com</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-900 bg-gray-950 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-black text-black">CE</span>
          </div>
          <div>
            <p className="text-white text-sm font-bold leading-tight">Creative Era Events</p>
            <p className="text-gray-500 text-xs">Event Brief Form</p>
          </div>
        </div>
        {/* Step indicator */}
        <div className="max-w-xl mx-auto px-4 pb-3 flex gap-1.5">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? 'bg-amber-500' : 'bg-gray-800'}`} />
          ))}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* ── STEP 1: Contact & Event Info ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-white text-lg font-bold">Your Details</h2>
              <p className="text-gray-500 text-sm mt-0.5">Tell us about yourself and the event</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1.5 block">Your Name *</label>
                <input
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Full name"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1.5 block">Phone Number *</label>
                <input
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                  type="tel"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1.5 block">Email</label>
                <input
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  placeholder="your@email.com"
                  type="email"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1.5 block">Organisation / Company Name</label>
                <input
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Company or organisation name"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                />
              </div>
            </div>

            <div className="pt-1">
              <h2 className="text-white text-lg font-bold">Event Details</h2>
              <p className="text-gray-500 text-sm mt-0.5">Basic information about the event</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1.5 block">Event Type</label>
                <select
                  value={eventType}
                  onChange={e => setEventType(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select event type…</option>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs font-medium mb-1.5 block">Event Date</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium mb-1.5 block">City</label>
                  <input
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Indore, Mumbai…"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                  />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1.5 block">Venue (if decided)</label>
                <input
                  value={venue}
                  onChange={e => setVenue(e.target.value)}
                  placeholder="Venue name or address"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs font-medium mb-1.5 block">Expected Guests</label>
                  <input
                    value={pax}
                    onChange={e => setPax(e.target.value)}
                    placeholder="e.g. 200"
                    type="number"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium mb-1.5 block">Budget Range (₹)</label>
                  <input
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    placeholder="e.g. 5-10 Lakh"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => { if (!clientName.trim() || !clientPhone.trim()) { setError('Name and phone are required.'); return; } setError(''); setStep(2) }}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-xl text-sm transition-colors"
            >
              Next — Requirements →
            </button>
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          </div>
        )}

        {/* ── STEP 2: Requirements ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <button onClick={() => setStep(1)} className="text-gray-500 text-xs hover:text-white mb-3">← Back</button>
              <h2 className="text-white text-lg font-bold">Event Requirements</h2>
              <p className="text-gray-500 text-sm mt-0.5">What do you need for this event?</p>
            </div>

            {/* Toggle mode */}
            <div className="flex gap-1 bg-gray-900 p-1 rounded-xl">
              <button onClick={() => setInputMode('text')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${inputMode === 'text' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}`}>
                Describe in words
              </button>
              <button onClick={() => setInputMode('list')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${inputMode === 'list' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}`}>
                List elements
              </button>
            </div>

            {inputMode === 'text' ? (
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1.5 block">
                  Describe your requirements
                </label>
                <textarea
                  value={requirements}
                  onChange={e => setRequirements(e.target.value)}
                  rows={8}
                  placeholder={`Example:\n- Stage 20×12 ft with backdrop\n- LED screen 10×6 ft\n- Lighting — 50 wash lights\n- Sound system for 300 pax\n- Welcome arch 12 ft height\n- Seating for 250 guests\n- Branding — 3 standees and 2 roll-ups`}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 resize-none placeholder-gray-600"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-gray-400 text-xs font-medium mb-1 block">Add each element separately</label>
                {elements.map((el, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      value={el.name}
                      onChange={e => updateElement(i, 'name', e.target.value)}
                      placeholder="Element (e.g. Stage, LED Screen…)"
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                    />
                    <input
                      value={el.spec}
                      onChange={e => updateElement(i, 'spec', e.target.value)}
                      placeholder="Size / Spec"
                      className="w-32 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                    />
                    <input
                      value={el.qty}
                      onChange={e => updateElement(i, 'qty', e.target.value)}
                      placeholder="Qty"
                      type="number"
                      min="1"
                      className="w-16 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm text-center focus:outline-none focus:border-amber-500"
                    />
                    {elements.length > 1 && (
                      <button onClick={() => removeElement(i)} className="text-gray-600 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addElement} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-amber-400 transition-colors mt-1">
                  <Plus size={14} /> Add element
                </button>
              </div>
            )}

            <button
              onClick={() => setStep(3)}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-xl text-sm transition-colors"
            >
              Next — Upload & Submit →
            </button>
          </div>
        )}

        {/* ── STEP 3: Upload & Submit ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <button onClick={() => setStep(2)} className="text-gray-500 text-xs hover:text-white mb-3">← Back</button>
              <h2 className="text-white text-lg font-bold">Upload Brief (Optional)</h2>
              <p className="text-gray-500 text-sm mt-0.5">If you have an existing element sheet, RFQ, or document — upload it here. Our AI will read it.</p>
            </div>

            {/* File upload */}
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-700 hover:border-amber-500/50 rounded-2xl p-6 text-center cursor-pointer transition-colors"
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <Paperclip size={16} className="text-amber-400" />
                  <span className="text-white text-sm font-medium">{file.name}</span>
                  <button
                    onClick={e => { e.stopPropagation(); setFile(null) }}
                    className="text-gray-500 hover:text-red-400 transition-colors ml-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={20} className="text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Click to upload</p>
                  <p className="text-gray-600 text-xs mt-1">.xlsx, .xls, .csv, .docx, .pdf supported</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.docx,.doc,.pdf"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />

            <div>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block">Anything else we should know?</label>
              <textarea
                value={extraNotes}
                onChange={e => setExtraNotes(e.target.value)}
                rows={4}
                placeholder="Special requirements, references, deadlines, style preferences…"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 resize-none placeholder-gray-600"
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-1.5">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Your Submission Summary</p>
              {[
                ['Name', clientName],
                ['Phone', clientPhone],
                ['Event Type', eventType],
                ['Date', eventDate ? new Date(eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''],
                ['City', city],
                ['Guests', pax],
              ].filter(([, v]) => v).map(([l, v]) => (
                <div key={l} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-600 w-20">{l}</span>
                  <span className="text-gray-300">{v}</span>
                </div>
              ))}
            </div>

            {error && <p className="text-red-400 text-xs text-center">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold py-3.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><div className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" /> Submitting…</>
              ) : (
                <><Send size={14} /> Submit Brief</>
              )}
            </button>

            <p className="text-gray-600 text-xs text-center">
              By submitting, you agree to be contacted by Creative Era Events regarding your enquiry.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
