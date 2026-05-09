'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Star, Download, MessageCircle, Lock } from 'lucide-react'

export default function ClaimActivation() {
  const params     = useSearchParams()
  const photoUrl   = params.get('url') ?? ''
  const configId   = params.get('config') ?? ''
  const brandName  = params.get('brand') ?? 'Your Brand'
  const brandColor = params.get('color') ?? '#1a1a2e'

  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [rating, setRating]       = useState(0)
  const [hover, setHover]         = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

  async function handleSubmit() {
    if (!name.trim()) { setError('Please enter your name'); return }
    if (phone.trim().length < 10) { setError('Enter a valid 10-digit WhatsApp number'); return }
    setError('')
    setSubmitting(true)
    try {
      await fetch('/api/brand-activation/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: configId || null,
          name: name.trim(),
          phone: phone.trim(),
          photo_url: photoUrl || null,
          rating: rating || null,
        }),
      })
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const whatsappUrl = photoUrl
    ? `https://wa.me/+91${phone.trim()}?text=${encodeURIComponent(`Hi ${name.split(' ')[0]}! 🎉 Here's your branded photo from ${brandName}. View & save: ${photoUrl}`)}`
    : ''

  if (!photoUrl) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-white text-lg font-bold mb-2">Invalid Link</p>
          <p className="text-gray-500 text-sm">This link is missing the photo. Please scan the QR code again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-10">
      {/* Brand header */}
      <div className="px-5 py-4 text-center" style={{ background: brandColor }}>
        <p className="text-white font-bold text-lg">{brandName}</p>
        <p className="text-white/60 text-xs mt-0.5">Your branded photo is ready!</p>
      </div>

      {/* Photo preview */}
      <div className="relative mx-5 mt-5 rounded-2xl overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt="Your branded photo"
          className={`w-full transition-all duration-500 ${submitted ? 'blur-0' : 'blur-xl scale-105'}`}
        />
        {!submitted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 gap-3">
            <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
              <Lock size={24} className="text-white" />
            </div>
            <p className="text-white font-semibold text-center px-6">Fill the form below to unlock your photo</p>
          </div>
        )}
      </div>

      {/* Form / Action buttons */}
      <div className="px-5 mt-5 space-y-4">
        {!submitted ? (
          <>
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Your Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500" />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">WhatsApp Number</label>
              <div className="flex items-center bg-gray-800 border border-gray-700 rounded-xl overflow-hidden focus-within:border-amber-500">
                <span className="px-3 py-3 text-gray-400 text-sm border-r border-gray-700">+91</span>
                <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit number" inputMode="numeric"
                  className="flex-1 bg-transparent px-3 py-3 text-white placeholder-gray-600 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium block mb-2">Rate Your Experience</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s}
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHover(s)}
                    onMouseLeave={() => setHover(0)}
                    className="text-3xl transition-transform active:scale-90">
                    {s <= (hover || rating) ? '⭐' : '☆'}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button onClick={handleSubmit} disabled={submitting}
              className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-50"
              style={{ background: brandColor, color: '#ffffff' }}>
              {submitting ? 'Unlocking...' : '🔓 Unlock My Photo'}
            </button>
          </>
        ) : (
          <div className="space-y-3 pt-2">
            <p className="text-green-400 text-center font-semibold text-sm">
              ✅ Your photo is unlocked! Send it to yourself:
            </p>

            {phone && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold text-base bg-[#25D366] text-white transition-all active:scale-95">
                <MessageCircle size={20} />
                Send to WhatsApp
              </a>
            )}

            <a href={photoUrl} download="branded-photo.jpg" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold text-base bg-gray-800 text-white border border-gray-700 transition-all active:scale-95">
              <Download size={20} />
              Save to Gallery
            </a>

            <p className="text-center text-gray-600 text-xs mt-4 px-4">
              Thank you for experiencing {brandName}! 🎉
            </p>
          </div>
        )}
      </div>

      {/* Star rating display after submit */}
      {submitted && rating > 0 && (
        <div className="flex justify-center mt-4 gap-1">
          {[1, 2, 3, 4, 5].map(s => (
            <Star key={s} size={20} fill={s <= rating ? '#f59e0b' : 'none'} color={s <= rating ? '#f59e0b' : '#4b5563'} />
          ))}
        </div>
      )}
    </div>
  )
}
