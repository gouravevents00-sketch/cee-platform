'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Camera, RefreshCw, Loader2 } from 'lucide-react'

type Stage = 'loading' | 'attract' | 'countdown' | 'processing' | 'uploading' | 'result' | 'error' | 'no-config'

interface BrandConfig {
  id: string
  name: string
  brand_name: string
  tagline: string
  primary_color: string
  secondary_color: string
  logo_data_url: string | null
  frame_style: 'strip' | 'polaroid' | 'corner'
}

const COUNTDOWN_FROM = 3
const CAPTURE_SIZE = 1080
const AUTO_RESET_SECS = 30

// --- Canvas frame renderer ---
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.crossOrigin = 'anonymous'
    img.src = src
  })
}

async function renderFrame(photoDataUrl: string, cfg: BrandConfig): Promise<string> {
  const W = 1080
  const PHOTO_H = 1080
  const STRIP_H = 270
  const TOTAL_H = PHOTO_H + STRIP_H

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const photo = await loadImg(photoDataUrl)
  const logo = cfg.logo_data_url ? await loadImg(cfg.logo_data_url) : null

  const drawText = (text: string, x: number, y: number, size: number, bold = false, alpha = 1) => {
    ctx.globalAlpha = alpha
    ctx.fillStyle = cfg.secondary_color
    ctx.font = `${bold ? 'bold ' : ''}${size}px -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x, y)
    ctx.globalAlpha = 1
  }

  if (cfg.frame_style === 'polaroid') {
    // White background polaroid
    const PAD_SIDE = 32
    const PAD_TOP = 32
    const PAD_BOTTOM = STRIP_H + PAD_TOP

    canvas.width = W
    canvas.height = TOTAL_H

    // White mat
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, TOTAL_H)

    // Photo with shadow
    ctx.shadowColor = 'rgba(0,0,0,0.15)'
    ctx.shadowBlur = 20
    ctx.drawImage(photo, PAD_SIDE, PAD_TOP, W - PAD_SIDE * 2, PHOTO_H - PAD_TOP)
    ctx.shadowBlur = 0

    // Brand strip at bottom
    ctx.fillStyle = cfg.primary_color
    ctx.fillRect(0, PHOTO_H, W, STRIP_H)

    // Logo in strip
    if (logo) {
      const lh = 100, lw = Math.min((logo.width / logo.height) * lh, 200)
      ctx.drawImage(logo, 60, PHOTO_H + (STRIP_H - lh) / 2, lw, lh)
    }

    // Brand name
    const textX = logo ? W * 0.62 : W / 2
    drawText(cfg.brand_name, textX, PHOTO_H + STRIP_H / 2 - (cfg.tagline ? 18 : 0), 52, true)
    if (cfg.tagline) drawText(cfg.tagline, textX, PHOTO_H + STRIP_H / 2 + 38, 30, false, 0.75)

    // Bottom white with hashtag hint
    ctx.fillStyle = '#f8f8f8'
    ctx.fillRect(0, TOTAL_H - PAD_BOTTOM + PAD_TOP, W, PAD_BOTTOM - PAD_TOP)

  } else if (cfg.frame_style === 'corner') {
    // Photo with corner logo badges only
    canvas.width = W
    canvas.height = PHOTO_H

    ctx.drawImage(photo, 0, 0, W, PHOTO_H)

    // Semi-transparent brand bar at bottom (slim)
    ctx.fillStyle = cfg.primary_color
    ctx.globalAlpha = 0.85
    ctx.fillRect(0, PHOTO_H - 100, W, 100)
    ctx.globalAlpha = 1

    if (logo) {
      // Corner logos: top-right + bottom-left
      const lh = 70, lw = Math.min((logo.width / logo.height) * lh, 150)
      ctx.drawImage(logo, W - lw - 24, 24, lw, lh)
    }

    drawText(cfg.brand_name, W / 2, PHOTO_H - 50, 38, true)
    if (cfg.tagline) drawText(cfg.tagline, W / 2, PHOTO_H - 20, 24, false, 0.8)

  } else {
    // Default: strip
    canvas.width = W
    canvas.height = TOTAL_H

    ctx.drawImage(photo, 0, 0, W, PHOTO_H)

    // Brand strip
    ctx.fillStyle = cfg.primary_color
    ctx.fillRect(0, PHOTO_H, W, STRIP_H)

    // Logo
    if (logo) {
      const lh = 120, lw = Math.min((logo.width / logo.height) * lh, 220)
      ctx.drawImage(logo, 50, PHOTO_H + (STRIP_H - lh) / 2, lw, lh)
    }

    // Text
    const textX = logo ? W * 0.62 : W / 2
    drawText(cfg.brand_name, textX, PHOTO_H + STRIP_H / 2 - (cfg.tagline ? 20 : 0), 56, true)
    if (cfg.tagline) drawText(cfg.tagline, textX, PHOTO_H + STRIP_H / 2 + 42, 32, false, 0.72)
  }

  return canvas.toDataURL('image/jpeg', 0.92)
}

export default function BrandStation() {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const resetRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  const [stage, setStage]         = useState<Stage>('loading')
  const [config, setConfig]       = useState<BrandConfig | null>(null)
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl]   = useState<string | null>(null)
  const [resetTimer, setResetTimer] = useState(AUTO_RESET_SECS)
  const [errorMsg, setErrorMsg]   = useState('')

  const searchParams = useSearchParams()
  const configId = searchParams.get('config')

  // Load brand config
  useEffect(() => {
    if (!configId) { setStage('no-config'); return }
    fetch(`/api/brand-activation/configs/${configId}`)
      .then(r => r.json())
      .then(({ config: cfg }) => {
        if (!cfg) { setStage('no-config'); return }
        setConfig(cfg)
        setStage('attract')
      })
      .catch(() => setStage('no-config'))
  }, [configId])

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setErrorMsg('Camera not accessible. Please allow camera permission.')
      setStage('error')
    }
  }, [])

  // Attach stream to video when countdown stage renders
  useEffect(() => {
    if (stage !== 'countdown') return
    if (streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [stage])

  // Stop camera
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  // Auto-reset timer in result stage
  useEffect(() => {
    if (stage !== 'result') return
    setResetTimer(AUTO_RESET_SECS)
    const interval = setInterval(() => {
      setResetTimer(prev => {
        if (prev <= 1) { clearInterval(interval); resetToAttract(); return AUTO_RESET_SECS }
        return prev - 1
      })
    }, 1000)
    resetRef.current = interval
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  function resetToAttract() {
    if (resetRef.current) clearInterval(resetRef.current)
    stopCamera()
    setResultUrl(null)
    setPhotoUrl(null)
    setErrorMsg('')
    setCountdown(COUNTDOWN_FROM)
    setStage('attract')
  }

  async function handleStart() {
    await startCamera()
    setStage('countdown')
    let n = COUNTDOWN_FROM
    const t = setInterval(async () => {
      n--
      setCountdown(n)
      if (n <= 0) {
        clearInterval(t)
        await captureAndProcess()
      }
    }, 1000)
  }

  async function captureAndProcess() {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video || !config) return

    // Capture square crop from video (mirrored)
    canvas.width = canvas.height = CAPTURE_SIZE
    const ctx = canvas.getContext('2d')!
    const vw = video.videoWidth, vh = video.videoHeight
    const size = Math.min(vw, vh)
    const sx = (vw - size) / 2, sy = (vh - size) / 2
    ctx.translate(CAPTURE_SIZE, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sx, sy, size, size, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE)
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.92)
    stopCamera()
    setStage('processing')

    try {
      // Apply brand frame
      const framedDataUrl = await renderFrame(photoDataUrl, config)
      setResultUrl(framedDataUrl) // preview locally

      setStage('uploading')

      // Upload to storage
      const base64 = framedDataUrl.split(',')[1]
      const res = await fetch('/api/brand-activation/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64, config_id: config.id }),
      })
      const { photo_url, error } = await res.json()
      if (error || !photo_url) throw new Error(error ?? 'Upload failed')
      setPhotoUrl(photo_url)
      setStage('result')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStage('error')
    }
  }

  // --- Render ---
  if (stage === 'loading') {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-amber-400" />
      </div>
    )
  }

  if (stage === 'no-config') {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Camera size={48} className="text-gray-600" />
        <p className="text-white text-xl font-bold">No Brand Config Found</p>
        <p className="text-gray-500 text-sm max-w-sm">
          Launch this station from the CEE Platform dashboard with a valid config ID.
        </p>
        <p className="text-gray-600 text-xs font-mono">/brand-station?config=&lt;uuid&gt;</p>
      </div>
    )
  }

  if (stage === 'error') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center"
        style={{ background: config?.primary_color ?? '#0f172a' }}>
        <p className="text-white text-xl font-bold">Oops!</p>
        <p className="text-white/70 text-sm max-w-sm">{errorMsg}</p>
        <button onClick={resetToAttract}
          className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-medium transition-colors">
          <RefreshCw size={16} /> Try Again
        </button>
      </div>
    )
  }

  if (stage === 'attract' && config) {
    const bg = config.primary_color
    const fg = config.secondary_color
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center select-none overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${bg} 0%, ${adjustColor(bg, -30)} 100%)` }}>
        {/* Animated rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[1, 2, 3].map(i => (
            <div key={i} className="absolute rounded-full border"
              style={{
                width: `${i * 240}px`, height: `${i * 240}px`,
                borderColor: fg, opacity: 0.08 - i * 0.02,
                animation: `ping ${2 + i * 0.5}s cubic-bezier(0,0,0.2,1) infinite`,
                animationDelay: `${i * 0.4}s`,
              }} />
          ))}
        </div>

        {/* Logo */}
        {config.logo_data_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.logo_data_url} alt={config.brand_name}
            className="w-48 h-32 object-contain mb-8 drop-shadow-2xl" />
        )}

        {/* Brand name */}
        <h1 className="text-6xl font-black tracking-tight mb-3 drop-shadow-lg text-center px-8"
          style={{ color: fg }}>
          {config.brand_name}
        </h1>
        {config.tagline && (
          <p className="text-xl mb-16 tracking-wide text-center px-8"
            style={{ color: fg, opacity: 0.7 }}>
            {config.tagline}
          </p>
        )}

        {/* CTA button */}
        <button onClick={handleStart}
          className="relative px-16 py-6 rounded-3xl text-2xl font-black transition-all active:scale-95 shadow-2xl"
          style={{ background: fg, color: bg }}>
          <span className="relative z-10">📸 Tap to Take Photo</span>
        </button>

        <p className="mt-8 text-sm tracking-widest uppercase" style={{ color: fg, opacity: 0.4 }}>
          Powered by Creative Era Experiences
        </p>
      </div>
    )
  }

  if (stage === 'countdown' && config) {
    const fg = config.secondary_color
    const bg = config.primary_color
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: '#000' }}>
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }} muted playsInline autoPlay />
        <canvas ref={canvasRef} className="hidden" />

        {/* Countdown overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
          {countdown > 0 ? (
            <>
              <div className="text-[200px] font-black leading-none drop-shadow-2xl" style={{ color: fg }}>
                {countdown}
              </div>
              <p className="text-2xl font-medium mt-4" style={{ color: fg, opacity: 0.8 }}>
                Smile! ☺
              </p>
            </>
          ) : (
            <div className="text-6xl font-black" style={{ color: fg }}>✨</div>
          )}
        </div>

        {/* Brand corner badge */}
        <div className="absolute top-6 right-6 flex items-center gap-3 px-4 py-2 rounded-2xl"
          style={{ background: bg + 'dd' }}>
          {config.logo_data_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logo_data_url} alt="" className="h-8 w-auto object-contain" />
          )}
          <span className="text-sm font-bold" style={{ color: fg }}>{config.brand_name}</span>
        </div>
      </div>
    )
  }

  if ((stage === 'processing' || stage === 'uploading') && config) {
    const fg = config.secondary_color
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6"
        style={{ background: `linear-gradient(135deg, ${config.primary_color} 0%, ${adjustColor(config.primary_color, -30)} 100%)` }}>
        <Loader2 size={64} className="animate-spin" style={{ color: fg }} />
        <p className="text-2xl font-bold" style={{ color: fg }}>
          {stage === 'processing' ? 'Applying your brand frame...' : 'Almost done...'}
        </p>
        {config.logo_data_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.logo_data_url} alt={config.brand_name}
            className="w-24 h-16 object-contain opacity-60" />
        )}
      </div>
    )
  }

  if (stage === 'result' && config && resultUrl) {
    const fg = config.secondary_color
    const bg = config.primary_color
    const claimUrl = photoUrl
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/brand-station/claim?url=${encodeURIComponent(photoUrl)}&config=${config.id}&brand=${encodeURIComponent(config.brand_name)}&color=${encodeURIComponent(bg)}`
      : ''
    const qrSrc = claimUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=000000&bgcolor=ffffff&data=${encodeURIComponent(claimUrl)}`
      : ''

    return (
      <div className="fixed inset-0 flex" style={{ background: '#0a0a0a' }}>
        <canvas ref={canvasRef} className="hidden" />

        {/* Branded photo — left 60% */}
        <div className="flex-1 relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="Your branded photo"
            className="absolute inset-0 w-full h-full object-contain" />
        </div>

        {/* Right panel — QR + info */}
        <div className="w-80 flex flex-col items-center justify-center gap-6 p-8"
          style={{ background: bg }}>
          {config.logo_data_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logo_data_url} alt={config.brand_name}
              className="w-32 h-20 object-contain" />
          )}

          <div className="text-center" style={{ color: fg }}>
            <p className="text-2xl font-black">{config.brand_name}</p>
            {config.tagline && <p className="text-sm mt-1 opacity-70">{config.tagline}</p>}
          </div>

          <div className="bg-white rounded-2xl p-3 shadow-2xl">
            {qrSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrSrc} alt="Scan QR" width={200} height={200} />
            ) : (
              <div className="w-[200px] h-[200px] flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-gray-400" />
              </div>
            )}
          </div>

          <div className="text-center" style={{ color: fg }}>
            <p className="text-lg font-bold">📱 Scan to get your photo</p>
            <p className="text-sm opacity-70 mt-1">Enter your WhatsApp number</p>
          </div>

          <div className="w-full mt-auto">
            <div className="text-center mb-3">
              <span className="text-sm font-medium" style={{ color: fg, opacity: 0.5 }}>
                New photo in {resetTimer}s
              </span>
            </div>
            <button onClick={resetToAttract}
              className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95"
              style={{ background: fg + '22', color: fg, border: `1px solid ${fg}44` }}>
              ↩ Take Another Photo
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// Darken/lighten a hex color by amount
function adjustColor(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return hex
  const r = Math.max(0, Math.min(255, parseInt(clean.slice(0, 2), 16) + amount))
  const g = Math.max(0, Math.min(255, parseInt(clean.slice(2, 4), 16) + amount))
  const b = Math.max(0, Math.min(255, parseInt(clean.slice(4, 6), 16) + amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
