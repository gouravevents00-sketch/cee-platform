'use client'

import { useState } from 'react'
import { Camera, ExternalLink, Info, Zap, Wifi, WifiOff } from 'lucide-react'

type EventType = 'corporate' | 'wedding' | 'party' | 'brand'

const FILTER_INFO = [
  { emoji: '📸', name: 'Original',  note: 'Instant — no AI' },
  { emoji: '🎬', name: 'Bollywood', note: '~5–8s — fal.ai' },
  { emoji: '🎨', name: 'Cartoon',   note: '~5–8s — fal.ai' },
  { emoji: '🖼️', name: 'Painting',  note: '~5–8s — fal.ai' },
  { emoji: '✏️', name: 'Sketch',    note: '~5–8s — fal.ai' },
]

export default function BoothOperator() {
  const [eventName, setEventName] = useState('')
  const [eventType, setEventType] = useState<EventType>('corporate')

  function launchBooth() {
    const params = new URLSearchParams()
    if (eventName) params.set('event', eventName)
    params.set('type', eventType)
    window.open(`/booth?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-5">

      {/* Quick Launch */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center flex-shrink-0">
            <Camera size={18} />
          </div>
          <div>
            <h2 className="text-white font-semibold">Launch AI Photo Booth</h2>
            <p className="text-gray-500 text-sm mt-0.5">Opens full-screen on this device or any iPad/tablet</p>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1.5">Event Name (optional)</label>
            <input
              type="text"
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              placeholder="e.g. HDFC Annual Day 2025"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1.5">Event Type</label>
            <div className="grid grid-cols-4 gap-2">
              {(['corporate', 'wedding', 'party', 'brand'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setEventType(t)}
                  className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                    eventType === t
                      ? 'bg-amber-500 text-black'
                      : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {t === 'brand' ? 'Brand' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={launchBooth}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-black font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20"
        >
          <ExternalLink size={16} />
          Launch Booth in New Tab
        </button>

        <p className="text-gray-600 text-xs text-center mt-3">
          Opens at <span className="text-gray-500 font-mono">/booth</span> — bookmark it on your iPad for quick access
        </p>
      </div>

      {/* AI Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={15} className="text-amber-400" />
          <h3 className="text-white font-semibold text-sm">Available Filters</h3>
        </div>
        <div className="space-y-2">
          {FILTER_INFO.map(f => (
            <div key={f.name} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{f.emoji}</span>
                <span className="text-white text-sm font-medium">{f.name}</span>
              </div>
              <span className="text-gray-500 text-xs">{f.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Requirements */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Info size={15} className="text-blue-400" />
          <h3 className="text-white font-semibold text-sm">Setup Requirements</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Wifi size={12} className="text-green-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">Internet Required for AI Filters</p>
              <p className="text-gray-500 text-xs mt-0.5">Original filter works offline. Bollywood/Cartoon/Painting/Sketch need internet (fal.ai API)</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Camera size={12} className="text-blue-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">Camera Permission</p>
              <p className="text-gray-500 text-xs mt-0.5">Allow camera access in browser when prompted. Works best on iPad/laptop with front camera</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <WifiOff size={12} className="text-orange-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">WhatsApp Sharing</p>
              <p className="text-gray-500 text-xs mt-0.5">Opens WhatsApp with pre-filled message + photo URL. Guest sends to themselves</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cost per event estimate */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-3">Estimated Running Cost</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">AI filter per photo (fal.ai)</span>
            <span className="text-white">~₹1.50–3</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">WhatsApp message (MSG91)</span>
            <span className="text-white">₹0.20–0.50</span>
          </div>
          <div className="border-t border-gray-800 pt-2 flex justify-between font-medium">
            <span className="text-gray-400">200 guests (avg event)</span>
            <span className="text-amber-400">~₹400–700</span>
          </div>
        </div>
      </div>

    </div>
  )
}
