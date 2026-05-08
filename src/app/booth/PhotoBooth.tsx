'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import NextImage from 'next/image'
import { Camera, RefreshCw, Download, MessageCircle, Settings, Play, X, Sparkles } from 'lucide-react'

type Stage = 'setup' | 'idle' | 'countdown' | 'captured' | 'processing' | 'result' | 'error'
type FilterId = 'neon' | 'royal' | 'magazine' | 'scifi' | 'warrior' | 'bollywood' | 'ghibli' | 'popstar'
type EventType = 'corporate' | 'wedding' | 'party' | 'brand'

interface Filter {
  id: FilterId
  label: string
  emoji: string
  description: string
  borderColor: string
  gradientFrom: string
}

const FILTERS: Filter[] = [
  { id: 'bollywood', label: 'Bollywood',   emoji: '🎬', description: 'Movie star energy',        borderColor: 'border-rose-500',   gradientFrom: 'from-rose-900'    },
  { id: 'neon',      label: 'Neon City',   emoji: '💜', description: 'Cyberpunk night scene',    borderColor: 'border-purple-500', gradientFrom: 'from-purple-900'  },
  { id: 'royal',     label: 'Royal',       emoji: '👑', description: 'Indian Maharaja palace',   borderColor: 'border-yellow-400', gradientFrom: 'from-yellow-900'  },
  { id: 'magazine',  label: 'Magazine',    emoji: '✨', description: 'Vogue cover shoot',        borderColor: 'border-zinc-300',   gradientFrom: 'from-zinc-700'    },
  { id: 'scifi',     label: 'Sci-Fi Hero', emoji: '🚀', description: 'Space station blockbuster',borderColor: 'border-blue-400',   gradientFrom: 'from-blue-900'    },
  { id: 'warrior',   label: 'Epic Warrior',emoji: '⚔️', description: 'Fantasy legend portrait',  borderColor: 'border-orange-400', gradientFrom: 'from-orange-900'  },
  { id: 'ghibli',    label: 'Ghibli',      emoji: '🌿', description: 'Studio Ghibli anime',      borderColor: 'border-green-400',  gradientFrom: 'from-green-900'   },
  { id: 'popstar',   label: 'Pop Star',    emoji: '🎤', description: 'Arena concert stage',      borderColor: 'border-pink-400',   gradientFrom: 'from-pink-900'    },
]

const COUNTDOWN_FROM = 3
const CAPTURE_SIZE = 1024
const AUTO_RESET_SECONDS = 30

export default function PhotoBooth() {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const autoResetRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [stage, setStage]               = useState<Stage>('setup')
  const [countdown, setCountdown]       = useState(COUNTDOWN_FROM)
  const [capturedUrl, setCapturedUrl]   = useState<string | null>(null)
  const [resultUrl, setResultUrl]       = useState<string | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<FilterId>('bollywood')
  const [progress, setProgress]         = useState(0)
  const [genTime, setGenTime]           = useState(0)
  const [errorMsg, setErrorMsg]         = useState('')
  const [autoResetTimer, setAutoResetTimer] = useState(AUTO_RESET_SECONDS)

  // Setup fields
  const searchParams = useSearchParams()
  const [eventName, setEventName]       = useState(() => searchParams.get('event') ?? '')
  const [eventType, setEventType]       = useState<EventType>(() => (searchParams.get('type') as EventType) ?? 'corporate')
  const [brandColor, setBrandColor]     = useState('#f59e0b')
  const [logoDataUrl, setLogoDataUrl]   = useState<string | null>(null)
  const [frameText, setFrameText]       = useState('')
  const [brandTheme, setBrandTheme]     = useState('')  // e.g. "BJP election rally" or "Samsung Galaxy S25 launch"

  // Lead capture
  const [leadCaptured, setLeadCaptured] = useState(false)
  const [leadName, setLeadName]         = useState('')
  const [leadPhone, setLeadPhone]       = useState('')
  const [leadSubmitting, setLeadSubmitting] = useState(false)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setErrorMsg('Camera access denied. Please allow camera permissions.')
      setStage('error')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const launchBooth = useCallback(async () => {
    await startCamera()
    setStage('idle')
  }, [startCamera])

  const captureFrame = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null
    const vw   = video.videoWidth
    const vh   = video.videoHeight
    const size = Math.min(vw, vh)
    const sx   = (vw - size) / 2
    const sy   = (vh - size) / 2
    canvas.width  = CAPTURE_SIZE
    canvas.height = CAPTURE_SIZE
    const ctx = canvas.getContext('2d')!
    ctx.save()
    ctx.translate(CAPTURE_SIZE, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sx, sy, size, size, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE)
    ctx.restore()
    return canvas.toDataURL('image/jpeg', 0.92)
  }, [])

  const startCountdown = useCallback(() => {
    setStage('countdown')
    setCountdown(COUNTDOWN_FROM)
    let c = COUNTDOWN_FROM
    const interval = setInterval(() => {
      c -= 1
      setCountdown(c)
      if (c <= 0) {
        clearInterval(interval)
        const dataUrl = captureFrame()
        if (dataUrl) {
          setCapturedUrl(dataUrl)
          setSelectedFilter('bollywood')
          setResultUrl(null)
          setLeadCaptured(false)
          setLeadName('')
          setLeadPhone('')
          setStage('captured')
        }
      }
    }, 1000)
  }, [captureFrame])

  // Re-assign stream when countdown video element mounts
  useEffect(() => {
    if (stage === 'countdown' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [stage])

  const applyFilter = useCallback(async (filter: FilterId) => {
    if (!capturedUrl) return
    setStage('processing')
    setProgress(0)
    setGenTime(0)
    const start = Date.now()
    const progressInterval = setInterval(() => {
      setGenTime(Math.round((Date.now() - start) / 1000))
      setProgress(p => p < 40 ? p + 3 : p < 70 ? p + 1.2 : p < 88 ? p + 0.5 : p < 95 ? p + 0.15 : p)
    }, 300)
    try {
      const base64 = capturedUrl.split(',')[1]
      const res = await fetch('/api/booth/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64,
          filter,
          brand_context: brandTheme || undefined,
        }),
      })
      clearInterval(progressInterval)
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Processing failed')
      }
      const { result_url } = await res.json()
      setResultUrl(result_url)
      setProgress(100)
      setStage('result')
    } catch (err: unknown) {
      clearInterval(progressInterval)
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStage('error')
    }
  }, [capturedUrl, brandTheme])

  const handleLeadSubmit = useCallback(async () => {
    if (!leadName.trim() || leadPhone.trim().length < 10) return
    setLeadSubmitting(true)
    try {
      await fetch('/api/booth/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leadName.trim(),
          phone: leadPhone.trim(),
          event_name: eventName || null,
          filter_used: selectedFilter,
          result_url: resultUrl,
        }),
      })
    } catch { /* non-blocking */ }
    setLeadCaptured(true)
    setLeadSubmitting(false)
  }, [leadName, leadPhone, eventName, selectedFilter, resultUrl])

  // Auto-reset on result stage
  useEffect(() => {
    if (stage !== 'result') {
      if (autoResetRef.current) clearInterval(autoResetRef.current)
      setAutoResetTimer(AUTO_RESET_SECONDS)
      return
    }
    setAutoResetTimer(AUTO_RESET_SECONDS)
    let t = AUTO_RESET_SECONDS
    autoResetRef.current = setInterval(() => {
      t -= 1
      setAutoResetTimer(t)
      if (t <= 0) {
        clearInterval(autoResetRef.current!)
        reset()
      }
    }, 1000)
    return () => { if (autoResetRef.current) clearInterval(autoResetRef.current) }
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    setCapturedUrl(null)
    setResultUrl(null)
    setErrorMsg('')
    setProgress(0)
    setGenTime(0)
    setSelectedFilter('bollywood')
    setLeadCaptured(false)
    setLeadName('')
    setLeadPhone('')
    setStage('idle')
  }, [])

  const exitBooth = useCallback(() => {
    stopCamera()
    setStage('setup')
  }, [stopCamera])

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setLogoDataUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const shareWhatsApp = useCallback(() => {
    if (!resultUrl || !leadCaptured) return
    const text = `My photo from ${eventName || 'the event'}! 📸\n${resultUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }, [resultUrl, eventName, leadCaptured])

  const downloadPhoto = useCallback(async () => {
    if (!resultUrl || !leadCaptured) return
    const canvas = document.createElement('canvas')
    const size = 1024
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    await new Promise<void>(resolve => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { ctx.drawImage(img, 0, 0, size, size); resolve() }
      img.src = resultUrl
    })

    if (logoDataUrl) {
      await new Promise<void>(resolve => {
        const logo = new Image()
        logo.onload = () => {
          ctx.globalAlpha = 0.92
          ctx.drawImage(logo, 16, 16, 110, 110)
          ctx.globalAlpha = 1
          resolve()
        }
        logo.src = logoDataUrl
      })
    }

    if (frameText || eventName) {
      const barH = 52
      ctx.fillStyle = brandColor
      ctx.fillRect(0, size - barH, size, barH)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 22px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(frameText || eventName, size / 2, size - barH / 2)
    }

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/jpeg', 0.94)
    link.download = `cee-photo-${Date.now()}.jpg`
    link.click()
  }, [resultUrl, logoDataUrl, brandColor, frameText, eventName, leadCaptured])

  const filterLabel = FILTERS.find(f => f.id === selectedFilter)?.label ?? ''

  const qrUrl = resultUrl && leadCaptured
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=000000&bgcolor=ffffff&data=${encodeURIComponent(resultUrl)}`
    : null

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (stage === 'setup') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-950 px-6 overflow-y-auto py-8">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center mb-2">
            <NextImage
              src="/cee-logo.png"
              alt="Creative Era Experiences"
              width={160}
              height={54}
              className="object-contain mx-auto mb-4"
              priority
            />
            <h1 className="text-white text-2xl font-bold">AI Photo Booth</h1>
            <p className="text-gray-500 text-xs mt-1">Operator Setup</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Event Name</label>
              <input
                type="text"
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                placeholder="e.g. HDFC Annual Day 2025"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
              />
            </div>

            {/* Brand/Event Theme — drives AI scene context */}
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1">
                Brand / Event Theme
                <span className="text-amber-500 ml-1">★ Powers AI scene</span>
              </label>
              <input
                type="text"
                value={brandTheme}
                onChange={e => setBrandTheme(e.target.value)}
                placeholder="e.g. BJP election rally · Samsung Galaxy launch · Reliance AGM"
                className="w-full bg-gray-900 border border-amber-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
              />
              <p className="text-gray-600 text-xs mt-1.5">This gets woven into every AI-generated photo automatically</p>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Event Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['corporate', 'wedding', 'party', 'brand'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setEventType(t)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      eventType === t
                        ? 'bg-amber-500 text-black'
                        : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {t === 'brand' ? 'Brand Activation' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-800 pt-4 space-y-3">
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Client Branding (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1.5">Brand Color</label>
                  <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={e => setBrandColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="text-gray-400 text-xs font-mono">{brandColor}</span>
                  </div>
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-medium block mb-1.5">Client Logo</label>
                  <label className="flex items-center justify-center gap-2 bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl px-3 py-2.5 cursor-pointer transition-colors">
                    <span className="text-gray-400 text-xs">{logoDataUrl ? '✓ Uploaded' : 'Upload PNG/JPG'}</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium block mb-1.5">Frame Text (bottom of photo)</label>
                <input
                  type="text"
                  value={frameText}
                  onChange={e => setFrameText(e.target.value)}
                  placeholder="e.g. Reliance Annual Meet · May 2025"
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"
                />
              </div>
            </div>
          </div>

          <button
            onClick={launchBooth}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold py-4 rounded-2xl text-base transition-all shadow-lg shadow-amber-500/20"
          >
            <Play size={18} />
            Launch Booth
          </button>
        </div>
      </div>
    )
  }

  // ── ALL LIVE STAGES ────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen bg-gray-950 select-none overflow-hidden relative">

      <canvas ref={canvasRef} className="hidden" />

      {/* ── IDLE ──────────────────────────────────────────────────────────── */}
      {stage === 'idle' && (
        <div className="h-full flex flex-col items-center justify-center gap-6">
          <button
            onClick={exitBooth}
            className="absolute top-4 right-4 p-2 text-gray-600 hover:text-gray-400 transition-colors"
          >
            <Settings size={20} />
          </button>

          <div className="text-center">
            <NextImage
              src="/cee-logo.png"
              alt="Creative Era Experiences"
              width={180}
              height={60}
              className="object-contain mx-auto mb-3"
              priority
            />
            {eventName && <p className="text-gray-400 text-base mb-1">{eventName}</p>}
            <h1 className="text-white text-4xl font-bold">AI Photo Booth</h1>
            {brandTheme && (
              <p className="text-amber-500/70 text-sm mt-1 flex items-center justify-center gap-1">
                <Sparkles size={12} /> {brandTheme}
              </p>
            )}
          </div>

          <button
            onClick={startCountdown}
            className="flex flex-col items-center gap-3 group"
          >
            <div
              className="w-40 h-40 rounded-full border-2 border-amber-500/40 group-hover:border-amber-500 flex items-center justify-center transition-all"
              style={{ boxShadow: '0 0 60px rgba(245,158,11,0.15)' }}
            >
              <div className="w-32 h-32 rounded-full bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center transition-colors">
                <Camera size={48} className="text-amber-400" />
              </div>
            </div>
            <p className="text-amber-400 text-xl font-bold tracking-wide animate-pulse">TAP TO START</p>
          </button>

          <p className="text-gray-600 text-sm">Step in front of the camera and tap</p>
        </div>
      )}

      {/* ── COUNTDOWN ─────────────────────────────────────────────────────── */}
      {stage === 'countdown' && (
        <div className="h-full flex flex-col items-center justify-center gap-6">
          <div className="relative w-80 h-80 sm:w-[420px] sm:h-[420px] rounded-3xl overflow-hidden border-2 border-amber-500/30">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div
                className="text-amber-400 font-bold"
                style={{ fontSize: '10rem', lineHeight: 1, textShadow: '0 0 60px rgba(245,158,11,0.9)' }}
              >
                {countdown > 0 ? countdown : '😊'}
              </div>
            </div>
          </div>
          <p className="text-amber-400 text-xl font-semibold animate-pulse">
            {countdown > 0 ? 'Get ready...' : 'Smile!'}
          </p>
        </div>
      )}

      {/* ── CAPTURED — pick filter ────────────────────────────────────────── */}
      {stage === 'captured' && capturedUrl && (
        <div className="h-full flex flex-col items-center justify-center gap-4 px-4 overflow-y-auto py-6">
          <div className="w-52 h-52 sm:w-64 sm:h-64 rounded-3xl overflow-hidden border-2 border-gray-700 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capturedUrl} alt="Your photo" className="w-full h-full object-cover" />
          </div>

          <div className="text-center">
            <p className="text-white text-base font-semibold">Choose your transformation</p>
            <p className="text-gray-600 text-xs mt-0.5">AI will place you into a cinematic scene</p>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-2xl border-2 transition-all ${
                  selectedFilter === f.id
                    ? `${f.borderColor} bg-gradient-to-b ${f.gradientFrom} to-transparent`
                    : 'border-gray-800 bg-gray-900/50'
                }`}
              >
                <span className="text-xl">{f.emoji}</span>
                <span className={`text-xs font-semibold leading-tight text-center ${selectedFilter === f.id ? 'text-white' : 'text-gray-500'}`}>
                  {f.label}
                </span>
              </button>
            ))}
          </div>

          <p className="text-amber-500/70 text-xs text-center max-w-xs">
            <Sparkles size={10} className="inline mr-1" />
            {FILTERS.find(f => f.id === selectedFilter)?.description}
            {brandTheme && ` · ${brandTheme} themed`}
          </p>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Retake
            </button>
            <button
              onClick={() => applyFilter(selectedFilter)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20"
            >
              <Sparkles size={16} />
              Apply {filterLabel}
            </button>
          </div>
        </div>
      )}

      {/* ── PROCESSING ────────────────────────────────────────────────────── */}
      {stage === 'processing' && (
        <div className="h-full flex flex-col items-center justify-center gap-8 px-6">
          <div className="text-center">
            <div className="text-7xl mb-4" style={{ animation: 'spin 3s linear infinite' }}>✨</div>
            <p className="text-white text-xl font-bold">Creating your {filterLabel}...</p>
            <p className="text-gray-500 text-sm mt-1">AI is building your cinematic scene · {genTime}s</p>
            {brandTheme && (
              <p className="text-amber-500/60 text-xs mt-1">Weaving in {brandTheme}</p>
            )}
          </div>
          <div className="w-72 bg-gray-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-amber-400 text-sm font-medium -mt-4">
            {progress < 25 ? 'Analysing your face...' :
             progress < 50 ? 'Building the scene...' :
             progress < 75 ? 'Placing you in it...' :
             progress < 92 ? 'Adding cinematic details...' : 'Final render...'}
          </p>
        </div>
      )}

      {/* ── RESULT ────────────────────────────────────────────────────────── */}
      {stage === 'result' && resultUrl && (
        <div className="h-full flex flex-col items-center justify-center gap-5 px-4 overflow-y-auto py-8">

          <button
            onClick={reset}
            className="absolute top-4 right-4 flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors"
          >
            <X size={12} /> Next ({autoResetTimer}s)
          </button>

          {/* Photos */}
          <div className="flex gap-4 items-end flex-shrink-0">
            {capturedUrl && (
              <>
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-gray-600 text-xs uppercase tracking-wider">Before</p>
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border border-gray-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={capturedUrl} alt="Original" className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="text-amber-400 text-2xl font-bold mb-2">→</div>
              </>
            )}
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-amber-400 text-xs uppercase tracking-wider font-medium">
                {filterLabel}
              </p>
              <div className="w-52 h-52 sm:w-60 sm:h-60 rounded-2xl overflow-hidden border-2 border-amber-500/40 shadow-2xl shadow-amber-500/10 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resultUrl}
                  alt="Result"
                  className={`w-full h-full object-cover transition-all duration-500 ${!leadCaptured ? 'blur-xl scale-105' : ''}`}
                />
                {/* Client logo overlay */}
                {logoDataUrl && leadCaptured && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoDataUrl}
                    alt="Brand logo"
                    className="absolute top-2 left-2 w-10 h-10 object-contain opacity-90"
                  />
                )}
                {/* Frame text bar */}
                {(frameText || eventName) && leadCaptured && (
                  <div
                    className="absolute bottom-0 left-0 right-0 text-white text-center text-xs font-semibold py-1.5 px-2 truncate"
                    style={{ backgroundColor: brandColor }}
                  >
                    {frameText || eventName}
                  </div>
                )}
                {/* Blur overlay — lead gate */}
                {!leadCaptured && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="text-3xl mb-1">🔒</div>
                    <p className="text-white text-xs font-bold text-center px-2">Enter details<br/>to unlock</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── LEAD GATE ── */}
          {!leadCaptured ? (
            <div className="w-full max-w-xs bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
              <div className="text-center">
                <p className="text-white font-bold text-sm">Your photo is ready! 🎉</p>
                <p className="text-gray-500 text-xs mt-0.5">Enter your details to download</p>
              </div>
              <input
                type="text"
                value={leadName}
                onChange={e => setLeadName(e.target.value)}
                placeholder="Your Name"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-500"
              />
              <input
                type="tel"
                value={leadPhone}
                onChange={e => setLeadPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="WhatsApp Number (10 digits)"
                maxLength={10}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-500"
              />
              <button
                onClick={handleLeadSubmit}
                disabled={leadSubmitting || !leadName.trim() || leadPhone.trim().length < 10}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl text-sm transition-all"
              >
                {leadSubmitting ? 'Saving...' : '🔓 Get My Photo'}
              </button>
            </div>
          ) : (
            /* ── SHARE BUTTONS — only after lead captured ── */
            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              {qrUrl && (
                <div className="flex flex-col items-center gap-2 bg-white rounded-2xl p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrUrl} alt="QR Code" width={140} height={140} />
                  <p className="text-gray-700 text-xs font-medium">Scan to open your photo</p>
                </div>
              )}
              <div className="flex gap-2 w-full">
                <button
                  onClick={shareWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 active:scale-95 text-white font-semibold py-3 rounded-xl text-sm transition-all"
                >
                  <MessageCircle size={16} />
                  WhatsApp
                </button>
                <button
                  onClick={downloadPhoto}
                  className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-4 py-3 rounded-xl text-sm transition-colors"
                >
                  <Download size={16} />
                </button>
              </div>
              <button
                onClick={reset}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold py-3 rounded-xl text-sm transition-all"
              >
                <Camera size={16} />
                Next Person
              </button>
            </div>
          )}

          <div className="absolute bottom-3">
            <NextImage src="/cee-logo.png" alt="Creative Era Experiences" width={80} height={27} className="object-contain opacity-30" />
          </div>
        </div>
      )}

      {/* ── ERROR ─────────────────────────────────────────────────────────── */}
      {stage === 'error' && (
        <div className="h-full flex flex-col items-center justify-center gap-6 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl">
            ⚠️
          </div>
          <div>
            <p className="text-white font-semibold text-lg mb-2">Something went wrong</p>
            <p className="text-gray-500 text-sm">{errorMsg}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setErrorMsg(''); setStage('idle') }}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-6 py-3 rounded-xl text-sm transition-colors"
            >
              <RefreshCw size={15} /> Try Again
            </button>
            <button
              onClick={exitBooth}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-3 rounded-xl text-sm transition-all"
            >
              <Settings size={15} /> Setup
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
