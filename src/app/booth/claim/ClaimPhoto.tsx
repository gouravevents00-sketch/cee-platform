'use client'

import { useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import NextImage from 'next/image'
import { Download, MessageCircle, Star } from 'lucide-react'

export default function ClaimPhoto() {
  const params      = useSearchParams()
  const resultUrl   = params.get('url')   ?? ''
  const eventName   = params.get('event') ?? ''
  const filterUsed  = params.get('filter') ?? ''
  const brandColor  = params.get('color') ?? '#f59e0b'
  const frameText   = params.get('text')  ?? ''

  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [rating, setRating]       = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { setError('Please enter your name'); return }
    if (phone.trim().length < 10) { setError('Please enter a valid 10-digit number'); return }
    setError('')
    setSubmitting(true)
    try {
      await fetch('/api/booth/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          event_name: eventName || null,
          filter_used: filterUsed || null,
          result_url: resultUrl || null,
          rating: rating || null,
        }),
      })
    } catch { /* non-blocking */ }
    setSubmitted(true)
    setSubmitting(false)
  }, [name, phone, rating, eventName, filterUsed, resultUrl])

  const sendToWhatsApp = useCallback(() => {
    if (!resultUrl) return
    const text = `Here's my AI photo from ${eventName || 'the event'}! 🎉\n\nDownload: ${resultUrl}`
    // Opens WhatsApp with photo URL pre-filled — user sends to themselves
    window.open(`https://wa.me/+91${phone.trim()}?text=${encodeURIComponent(text)}`, '_blank')
  }, [resultUrl, eventName, phone])

  if (!resultUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-center px-6">
        <p className="text-white font-bold text-lg mb-2">Invalid link</p>
        <p className="text-gray-500 text-sm">This QR code has expired or is invalid.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center pb-10">

      {/* Header */}
      <div className="w-full px-5 pt-6 pb-4 flex items-center justify-center">
        <NextImage src="/cee-logo.png" alt="Creative Era Experiences" width={120} height={40} className="object-contain" />
      </div>

      {/* Photo */}
      <div className="w-full max-w-sm px-5">
        <div className="relative w-full aspect-square rounded-3xl overflow-hidden border-2 border-amber-500/30 shadow-2xl shadow-amber-500/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resultUrl}
            alt="Your AI photo"
            className={`w-full h-full object-cover transition-all duration-500 ${!submitted ? 'blur-lg scale-105' : ''}`}
          />
          {/* Frame bar */}
          {(frameText || eventName) && submitted && (
            <div
              className="absolute bottom-0 left-0 right-0 text-white text-center text-xs font-bold py-2 px-3 truncate"
              style={{ backgroundColor: brandColor }}
            >
              {frameText || eventName}
            </div>
          )}
          {/* Lock overlay */}
          {!submitted && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl mb-2">🔒</div>
              <p className="text-white text-sm font-bold text-center px-4">Fill details below<br/>to unlock your photo</p>
            </div>
          )}
        </div>

        {eventName && (
          <p className="text-gray-500 text-xs text-center mt-2">{eventName}</p>
        )}
      </div>

      {/* Form or Share buttons */}
      <div className="w-full max-w-sm px-5 mt-5">
        {!submitted ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <div className="text-center">
              <p className="text-white font-bold">Your photo is ready! 🎉</p>
              <p className="text-gray-500 text-xs mt-0.5">Enter details to unlock and save it</p>
            </div>

            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your Name"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-500"
            />

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">+91</span>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="WhatsApp Number"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-12 pr-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-500"
              />
            </div>

            {/* Star rating */}
            <div className="space-y-1.5">
              <p className="text-gray-400 text-xs font-medium text-center">How was your experience?</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform active:scale-90"
                  >
                    <Star
                      size={32}
                      className={`transition-colors ${
                        star <= (hoverRating || rating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-gray-700'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-400 text-xs text-center">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-3.5 rounded-xl text-sm transition-all active:scale-95"
            >
              {submitting ? 'Unlocking...' : '🔓 Unlock My Photo'}
            </button>

            <p className="text-gray-600 text-xs text-center">
              Your number is safe — we use it only to send your photo
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-white font-bold text-base">
              Here&apos;s your photo, {name.split(' ')[0]}! 🎊
            </p>

            {/* WhatsApp — sends to their own number */}
            <button
              onClick={sendToWhatsApp}
              className="w-full flex items-center justify-center gap-2.5 bg-green-600 hover:bg-green-500 active:scale-95 text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-lg shadow-green-600/20"
            >
              <MessageCircle size={20} />
              Send to My WhatsApp (+91 {phone})
            </button>

            {/* Direct download */}
            <a
              href={resultUrl}
              download={`cee-photo-${Date.now()}.jpg`}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-4 rounded-2xl text-sm transition-colors"
            >
              <Download size={20} />
              Save to Gallery
            </a>

            {rating > 0 && (
              <p className="text-center text-gray-500 text-xs mt-2">
                Thank you for your {rating}⭐ rating!
              </p>
            )}

            <div className="text-center pt-2">
              <p className="text-gray-600 text-xs">Powered by Creative Era Experiences</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
