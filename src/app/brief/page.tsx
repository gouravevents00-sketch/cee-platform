'use client'

import { useState, useRef } from 'react'

type Step = 'info' | 'brief' | 'review' | 'done'

interface FormInfo {
  name: string
  company: string
  phone: string
  email: string
  event_type: string
  event_date: string
  city: string
  guest_count: string
  budget: string
}

interface ParsedBrief {
  event_summary: string
  event_type: string
  confirmed_details: { date?: string; city?: string; guest_count?: string; budget_range?: string }
  key_requirements: string[]
  clarifications_needed: string[]
}

const EVENT_TYPES = [
  'Conference / Seminar', 'Product Launch', 'Award Ceremony', 'Brand Activation',
  'Government Inauguration', 'Exhibition / Trade Show', 'Corporate Dinner / Gala',
  'Wedding / Social', 'Other',
]

const BUDGET_RANGES = [
  'Under ₹2 Lakhs', '₹2–5 Lakhs', '₹5–10 Lakhs', '₹10–25 Lakhs',
  '₹25–50 Lakhs', 'Above ₹50 Lakhs', 'To be decided',
]

const GUEST_RANGES = ['Under 50', '50–100', '100–250', '250–500', '500–1000', '1000+']

export default function BriefPage() {
  const [step, setStep] = useState<Step>('info')
  const [info, setInfo] = useState<FormInfo>({
    name: '', company: '', phone: '', email: '',
    event_type: '', event_date: '', city: '', guest_count: '', budget: '',
  })
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [brief, setBrief] = useState<ParsedBrief | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function updateInfo(field: keyof FormInfo, value: string) {
    setInfo(prev => ({ ...prev, [field]: value }))
  }

  function infoValid() {
    return info.name.trim() && info.phone.trim() && info.event_type
  }

  async function handleAnalyze() {
    if (!description.trim() && !file) {
      setParseError('Please describe your event or upload a document.')
      return
    }
    setParsing(true)
    setParseError('')

    const fd = new FormData()
    fd.append('action', 'parse')
    fd.append('name', info.name)
    fd.append('company', info.company)
    fd.append('event_type', info.event_type)
    fd.append('event_date', info.event_date)
    fd.append('city', info.city)
    fd.append('guest_count', info.guest_count)
    fd.append('budget', info.budget)
    fd.append('description', description)
    if (file) fd.append('file', file)

    try {
      const res = await fetch('/api/ai/brief', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.brief) {
        setBrief(data.brief)
        setStep('review')
      } else {
        setParseError(data.error || 'Analysis failed. Please try again.')
      }
    } catch {
      setParseError('Network error. Please try again.')
    } finally {
      setParsing(false)
    }
  }

  async function handleSubmit() {
    if (!brief) return
    setSubmitting(true)

    const fd = new FormData()
    fd.append('action', 'submit')
    fd.append('name', info.name)
    fd.append('company', info.company)
    fd.append('phone', info.phone)
    fd.append('email', info.email)
    fd.append('event_type', info.event_type)
    fd.append('est_budget', info.budget.replace(/[^0-9]/g, '') || '0')
    fd.append('brief', JSON.stringify(brief))

    try {
      const res = await fetch('/api/ai/brief', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.ok) setStep('done')
      else alert(data.error || 'Submission failed. Please try again.')
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Step Indicator ──────────────────────────────────────────────────────────

  const steps = [
    { id: 'info', label: 'Your Details' },
    { id: 'brief', label: 'Event Brief' },
    { id: 'review', label: 'Review' },
  ]
  const stepIndex = steps.findIndex(s => s.id === step)

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">Event Brief</p>
          <p className="text-xs text-gray-400 leading-tight">Creative Era Events</p>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-xl">

          {/* Step indicator */}
          {step !== 'done' && (
            <div className="flex items-center gap-2 mb-8">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      i < stepIndex ? 'bg-violet-600 text-white' :
                      i === stepIndex ? 'bg-violet-600 text-white ring-2 ring-violet-400/30' :
                      'bg-gray-800 text-gray-500'
                    }`}>
                      {i < stepIndex ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : i + 1}
                    </div>
                    <span className={`text-xs ${i === stepIndex ? 'text-white' : 'text-gray-500'}`}>{s.label}</span>
                  </div>
                  {i < steps.length - 1 && <div className={`flex-1 h-px ${i < stepIndex ? 'bg-violet-600' : 'bg-gray-800'}`} />}
                </div>
              ))}
            </div>
          )}

          {/* ── Step 1: Info ── */}
          {step === 'info' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-semibold text-white">Tell us about yourself</h1>
                <p className="text-sm text-gray-400 mt-1">We'll use this to get in touch with you.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1 block">Your name *</label>
                  <input value={info.name} onChange={e => updateInfo('name', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500 transition-colors"
                    placeholder="Full name" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Company / Organisation</label>
                  <input value={info.company} onChange={e => updateInfo('company', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500 transition-colors"
                    placeholder="Company name" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Phone *</label>
                  <input value={info.phone} onChange={e => updateInfo('phone', e.target.value)} type="tel"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500 transition-colors"
                    placeholder="+91 98765 43210" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1 block">Email</label>
                  <input value={info.email} onChange={e => updateInfo('email', e.target.value)} type="email"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500 transition-colors"
                    placeholder="you@company.com" />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-2 block">Event type *</label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map(t => (
                    <button key={t} onClick={() => updateInfo('event_type', t)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        info.event_type === t
                          ? 'bg-violet-600 border-violet-600 text-white'
                          : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Event date</label>
                  <input value={info.event_date} onChange={e => updateInfo('event_date', e.target.value)} type="date"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">City</label>
                  <input value={info.city} onChange={e => updateInfo('city', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500 transition-colors"
                    placeholder="Delhi, Mumbai..." />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Approx guests</label>
                  <div className="flex flex-wrap gap-1.5">
                    {GUEST_RANGES.map(g => (
                      <button key={g} onClick={() => updateInfo('guest_count', g)}
                        className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                          info.guest_count === g ? 'bg-violet-600 border-violet-600 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
                        }`}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Budget range</label>
                  <div className="flex flex-wrap gap-1.5">
                    {BUDGET_RANGES.map(b => (
                      <button key={b} onClick={() => updateInfo('budget', b)}
                        className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                          info.budget === b ? 'bg-violet-600 border-violet-600 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
                        }`}>
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={() => setStep('brief')} disabled={!infoValid()}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl py-3 text-sm transition-colors">
                Continue →
              </button>
            </div>
          )}

          {/* ── Step 2: Brief ── */}
          {step === 'brief' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-semibold text-white">Describe your event</h1>
                <p className="text-sm text-gray-400 mt-1">
                  Upload your element sheet, tender, or any reference document — or describe what you need in the box below.
                </p>
              </div>

              {/* File Upload */}
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
                  file ? 'border-violet-500 bg-violet-500/5' : 'border-gray-700 hover:border-gray-500'
                }`}
              >
                <input ref={fileRef} type="file"
                  accept=".xlsx,.xls,.csv,.docx,.doc,.pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)} />
                {file ? (
                  <div>
                    <p className="text-sm text-violet-400 font-medium">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
                    <button onClick={e => { e.stopPropagation(); setFile(null) }}
                      className="text-xs text-gray-500 hover:text-red-400 mt-1 transition-colors">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <svg className="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-gray-300">Upload your document</p>
                    <p className="text-xs text-gray-600 mt-1">Excel, Word, PDF, or Image</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-xs text-gray-600">or describe in text</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              {/* Text Description */}
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what you need for the event — stage setup, branding, AV, decor, any specific requirements..."
                rows={5}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500 transition-colors resize-none"
              />

              {parseError && <p className="text-xs text-red-400">{parseError}</p>}

              <div className="flex gap-3">
                <button onClick={() => setStep('info')}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-3 text-sm transition-colors">
                  ← Back
                </button>
                <button onClick={handleAnalyze} disabled={parsing || (!description.trim() && !file)}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2">
                  {parsing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : 'Analyze Brief →'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Review ── */}
          {step === 'review' && brief && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-semibold text-white">Review your brief</h1>
                <p className="text-sm text-gray-400 mt-1">
                  Here's what we understood. Please review before submitting to our team.
                </p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Event Summary</p>
                  <p className="text-sm text-white">{brief.event_summary}</p>
                </div>

                {(brief.confirmed_details.date || brief.confirmed_details.city || brief.confirmed_details.guest_count || brief.confirmed_details.budget_range) && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Confirmed Details</p>
                    <div className="flex flex-wrap gap-2">
                      {brief.confirmed_details.date && <span className="text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded-lg">📅 {brief.confirmed_details.date}</span>}
                      {brief.confirmed_details.city && <span className="text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded-lg">📍 {brief.confirmed_details.city}</span>}
                      {brief.confirmed_details.guest_count && <span className="text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded-lg">👥 {brief.confirmed_details.guest_count} guests</span>}
                      {brief.confirmed_details.budget_range && <span className="text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded-lg">💰 {brief.confirmed_details.budget_range}</span>}
                    </div>
                  </div>
                )}

                {brief.key_requirements?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Key Requirements</p>
                    <ul className="space-y-1">
                      {brief.key_requirements.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                          <span className="text-violet-400 mt-0.5 flex-shrink-0">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {brief.clarifications_needed?.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    <p className="text-xs text-amber-400 font-medium mb-1">Our team will follow up on:</p>
                    <ul className="space-y-0.5">
                      {brief.clarifications_needed.map((q, i) => (
                        <li key={i} className="text-xs text-amber-300/80">• {q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('brief')}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-3 text-sm transition-colors">
                  ← Edit
                </button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2">
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : 'Submit to Creative Era Events ✓'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === 'done' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-white mb-2">Brief received.</h1>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">
                Our team has been notified and will get back to you within 24 hours.
              </p>
              {info.email && (
                <p className="text-xs text-gray-600 mt-2">Confirmation sent to {info.email}</p>
              )}
              <div className="mt-8 pt-6 border-t border-gray-800">
                <p className="text-xs text-gray-600">Creative Era Events · creativeeraevents.com</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
