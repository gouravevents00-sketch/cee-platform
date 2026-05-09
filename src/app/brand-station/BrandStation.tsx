'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Camera, RefreshCw, Loader2, Zap } from 'lucide-react'

type Stage = 'loading' | 'attract' | 'countdown' | 'ai' | 'framing' | 'uploading' | 'result' | 'error' | 'no-config'

interface BrandConfig {
  id: string
  brand_name: string
  tagline: string
  primary_color: string
  secondary_color: string
  logo_data_url: string | null
  frame_style: 'strip' | 'polaroid' | 'corner'
  scene_prompt: string | null
}

const COUNTDOWN_FROM = 3
const CAPTURE_SIZE = 1024
const AUTO_RESET_SECS = 30

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.crossOrigin = 'anonymous'
    img.src = src
  })
}

// Apply brand frame overlay on top of the AI-generated photo (fetched from URL)
async function applyBrandFrame(aiImageUrl: string, cfg: BrandConfig): Promise<string> {
  const W = 1080, PHOTO_H = 1080, STRIP_H = 270
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const photo = await loadImg(aiImageUrl)
  const logo = cfg.logo_data_url ? await loadImg(cfg.logo_data_url) : null

  const drawText = (text: string, x: number, y: number, size: number, bold = false, alpha = 1) => {
    ctx.globalAlpha = alpha
    ctx.fillStyle = cfg.secondary_color
    ctx.font = `${bold ? 'bold ' : ''}${size}px -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Truncate long text
    const maxW = 400
    ctx.fillText(text.length > 30 ? text.slice(0, 30) + '…' : text, x, y, maxW)
    ctx.globalAlpha = 1
  }

  if (cfg.frame_style === 'corner') {
    canvas.width = W; canvas.height = PHOTO_H
    ctx.drawImage(photo, 0, 0, W, PHOTO_H)
    // Slim gradient bar
    const grad = ctx.createLinearGradient(0, PHOTO_H - 120, 0, PHOTO_H)
    grad.addColorStop(0, 'transparent')
    grad.addColorStop(1, cfg.primary_color + 'ee')
    ctx.fillStyle = grad
    ctx.fillRect(0, PHOTO_H - 120, W, 120)
    if (logo) {
      const lh = 55, lw = Math.min((logo.width / logo.height) * lh, 120)
      ctx.drawImage(logo, W - lw - 20, 20, lw, lh)
    }
    drawText(cfg.brand_name, W / 2, PHOTO_H - 55, 38, true)
    if (cfg.tagline) drawText(cfg.tagline, W / 2, PHOTO_H - 22, 24, false, 0.75)

  } else if (cfg.frame_style === 'polaroid') {
    canvas.width = W; canvas.height = W + STRIP_H
    ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0, 0, W, W + STRIP_H)
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 24
    ctx.drawImage(photo, 28, 28, W - 56, PHOTO_H - 28)
    ctx.shadowBlur = 0
    // Brand strip
    ctx.fillStyle = cfg.primary_color; ctx.fillRect(0, PHOTO_H, W, STRIP_H)
    if (logo) {
      const lh = 100, lw = Math.min((logo.width / logo.height) * lh, 200)
      ctx.drawImage(logo, 52, PHOTO_H + (STRIP_H - lh) / 2, lw, lh)
    }
    const tx = logo ? W * 0.62 : W / 2
    drawText(cfg.brand_name, tx, PHOTO_H + STRIP_H / 2 - (cfg.tagline ? 22 : 0), 52, true)
    if (cfg.tagline) drawText(cfg.tagline, tx, PHOTO_H + STRIP_H / 2 + 40, 30, false, 0.72)

  } else {
    // strip (default)
    canvas.width = W; canvas.height = W + STRIP_H
    ctx.drawImage(photo, 0, 0, W, PHOTO_H)
    ctx.fillStyle = cfg.primary_color; ctx.fillRect(0, PHOTO_H, W, STRIP_H)
    if (logo) {
      const lh = 120, lw = Math.min((logo.width / logo.height) * lh, 220)
      ctx.drawImage(logo, 50, PHOTO_H + (STRIP_H - lh) / 2, lw, lh)
    }
    const tx = logo ? W * 0.62 : W / 2
    drawText(cfg.brand_name, tx, PHOTO_H + STRIP_H / 2 - (cfg.tagline ? 22 : 0), 56, true)
    if (cfg.tagline) drawText(cfg.tagline, tx, PHOTO_H + STRIP_H / 2 + 42, 32, false, 0.72)
  }

  return canvas.toDataURL('image/jpeg', 0.93)
}

function adjustColor(hex: string, amount: number): string {
  const c = hex.replace('#', '')
  if (c.length !== 6) return hex
  const r = Math.max(0, Math.min(255, parseInt(c.slice(0, 2), 16) + amount))
  const g = Math.max(0, Math.min(255, parseInt(c.slice(2, 4), 16) + amount))
  const b = Math.max(0, Math.min(255, parseInt(c.slice(4, 6), 16) + amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export default function BrandStation() {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const resetRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  const [stage, setStage]           = useState<Stage>('loading')
  const [config, setConfig]         = useState<BrandConfig | null>(null)
  const [countdown, setCountdown]   = useState(COUNTDOWN_FROM)
  const [resultUrl, setResultUrl]   = useState<string | null>(null)
  const [photoUrl, setPhotoUrl]     = useState<string | null>(null)
  const [resetTimer, setResetTimer] = useState(AUTO_RESET_SECS)
  const [errorMsg, setErrorMsg]     = useState('')
  const [aiProgress, setAiProgress] = useState(0)

  const searchParams = useSearchParams()
  const configId = searchParams.get('config')

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

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
    } catch {
      setErrorMsg('Camera not accessible. Please allow camera permission and try again.')
      setStage('error')
    }
  }, [])

  useEffect(() => {
    if (stage !== 'countdown') return
    if (streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [stage])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  // Auto-reset countdown in result stage
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
    setResultUrl(null); setPhotoUrl(null); setErrorMsg('')
    setCountdown(COUNTDOWN_FROM); setAiProgress(0)
    setStage('attract')
  }

  async function handleStart() {
    await startCamera()
    if (streamRef.current) setStage('countdown')
    let n = COUNTDOWN_FROM
    const t = setInterval(async () => {
      n--
      setCountdown(n)
      if (n <= 0) { clearInterval(t); await captureAndProcess() }
    }, 1000)
  }

  async function captureAndProcess() {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video || !config) return

    canvas.width = canvas.height = CAPTURE_SIZE
    const ctx = canvas.getContext('2d')!
    const vw = video.videoWidth, vh = video.videoHeight
    const size = Math.min(vw, vh)
    const sx = (vw - size) / 2, sy = (vh - size) / 2
    ctx.translate(CAPTURE_SIZE, 0); ctx.scale(-1, 1)
    ctx.drawImage(video, sx, sy, size, size, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE)
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    const photoBase64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1]
    stopCamera()

    // Step 1: AI scene generation
    setStage('ai')
    setAiProgress(0)
    const progressInterval = setInterval(() => {
      setAiProgress(p => Math.min(p + 3, 90))
    }, 400)

    try {
      const aiRes = await fetch('/api/brand-activation/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: photoBase64, config_id: config.id }),
      })
      const { ai_url, error: aiErr } = await aiRes.json()
      clearInterval(progressInterval)
      setAiProgress(100)

      if (aiErr || !ai_url) throw new Error(aiErr ?? 'AI processing failed')

      // Step 2: Apply brand frame overlay on AI result
      setStage('framing')
      const framedDataUrl = await applyBrandFrame(ai_url, config)
      setResultUrl(framedDataUrl)

      // Step 3: Upload final framed photo
      setStage('uploading')
      const base64 = framedDataUrl.split(',')[1]
      const upRes = await fetch('/api/brand-activation/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64, config_id: config.id }),
      })
      const { photo_url, error: upErr } = await upRes.json()
      if (upErr || !photo_url) throw new Error(upErr ?? 'Upload failed')

      setPhotoUrl(photo_url)
      setStage('result')
    } catch (err) {
      clearInterval(progressInterval)
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStage('error')
    }
  }

  // --- SCREENS ---

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
        <p className="text-gray-500 text-sm max-w-xs">Launch this station from the CEE Platform operator panel with a valid config ID.</p>
        <p className="text-gray-700 text-xs font-mono">/brand-station?config=uuid</p>
      </div>
    )
  }

  if (stage === 'error') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center"
        style={{ background: config?.primary_color ?? '#0f172a' }}>
        <p className="text-white text-2xl font-bold">Oops, something went wrong</p>
        <p className="text-white/60 text-sm max-w-sm">{errorMsg}</p>
        <button onClick={resetToAttract}
          className="flex items-center gap-2 px-8 py-4 bg-white/15 hover:bg-white/25 text-white rounded-2xl font-bold transition-colors">
          <RefreshCw size={18} /> Try Again
        </button>
      </div>
    )
  }

  if (stage === 'attract' && config) {
    const bg = config.primary_color
    const fg = config.secondary_color
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center select-none overflow-hidden cursor-pointer"
        style={{ background: `linear-gradient(145deg, ${bg} 0%, ${adjustColor(bg, -40)} 100%)` }}
        onClick={handleStart}>
        {/* Ambient rings */}
        {[280, 480, 680].map((s, i) => (
          <div key={i} className="absolute rounded-full border pointer-events-none"
            style={{ width: s, height: s, borderColor: fg, opacity: 0.06,
              animation: `ping ${2.5 + i * 0.6}s cubic-bezier(0,0,0.2,1) infinite`,
              animationDelay: `${i * 0.5}s` }} />
        ))}

        {config.logo_data_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.logo_data_url} alt={config.brand_name}
            className="w-52 h-36 object-contain mb-8 drop-shadow-2xl" />
        )}

        <h1 className="text-7xl font-black text-center px-8 leading-none mb-4 drop-shadow-xl"
          style={{ color: fg }}>
          {config.brand_name}
        </h1>

        {config.tagline && (
          <p className="text-2xl text-center px-8 mb-14 tracking-wide" style={{ color: fg, opacity: 0.65 }}>
            {config.tagline}
          </p>
        )}

        <div className="flex items-center gap-3 px-12 py-6 rounded-3xl text-2xl font-black shadow-2xl transition-transform active:scale-95"
          style={{ background: fg, color: bg }}>
          <Camera size={28} />
          Tap to Take Your Photo
        </div>

        <p className="absolute bottom-6 text-xs tracking-widest uppercase" style={{ color: fg, opacity: 0.3 }}>
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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/25">
          <div className="text-[220px] font-black leading-none drop-shadow-2xl" style={{ color: fg }}>
            {countdown > 0 ? countdown : '✨'}
          </div>
          {countdown > 0 && (
            <p className="text-3xl font-medium mt-2" style={{ color: fg, opacity: 0.8 }}>Smile! ☺</p>
          )}
        </div>
        <div className="absolute top-6 right-6 flex items-center gap-3 px-5 py-2.5 rounded-2xl"
          style={{ background: bg + 'ee' }}>
          {config.logo_data_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logo_data_url} alt="" className="h-9 w-auto object-contain" />
          )}
          <span className="text-sm font-bold" style={{ color: fg }}>{config.brand_name}</span>
        </div>
      </div>
    )
  }

  if ((stage === 'ai' || stage === 'framing' || stage === 'uploading') && config) {
    const fg = config.secondary_color
    const bg = config.primary_color
    const msgs: Record<string, string> = {
      ai: 'Creating your branded scene…',
      framing: 'Adding brand identity…',
      uploading: 'Finishing up…',
    }
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-8"
        style={{ background: `linear-gradient(145deg, ${bg} 0%, ${adjustColor(bg, -40)} 100%)` }}>
        {config.logo_data_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.logo_data_url} alt="" className="w-28 h-20 object-contain opacity-70" />
        )}

        <div className="flex flex-col items-center gap-4">
          <Zap size={56} className="animate-pulse" style={{ color: fg }} />
          <p className="text-2xl font-bold text-center px-8" style={{ color: fg }}>
            {msgs[stage]}
          </p>
          {stage === 'ai' && (
            <p className="text-base opacity-60 text-center" style={{ color: fg }}>
              AI is placing you in the {config.brand_name} scene — ~10 seconds
            </p>
          )}
        </div>

        {/* Progress bar */}
        {stage === 'ai' && (
          <div className="w-72 h-2 rounded-full overflow-hidden" style={{ background: fg + '33' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${aiProgress}%`, background: fg }} />
          </div>
        )}
      </div>
    )
  }

  if (stage === 'result' && config && resultUrl) {
    const bg = config.primary_color
    const fg = config.secondary_color
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const claimUrl = photoUrl
      ? `${origin}/brand-station/claim?url=${encodeURIComponent(photoUrl)}&config=${config.id}&brand=${encodeURIComponent(config.brand_name)}&color=${encodeURIComponent(bg)}`
      : ''
    const qrSrc = claimUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&color=000000&bgcolor=ffffff&data=${encodeURIComponent(claimUrl)}`
      : ''

    return (
      <div className="fixed inset-0 flex" style={{ background: '#080808' }}>
        <canvas ref={canvasRef} className="hidden" />

        {/* Photo — takes most of the screen */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="Your branded photo"
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
        </div>

        {/* Right panel */}
        <div className="w-72 flex flex-col items-center justify-between py-8 px-6"
          style={{ background: bg }}>
          <div className="flex flex-col items-center gap-4">
            {config.logo_data_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logo_data_url} alt="" className="w-32 h-20 object-contain" />
            )}
            <div className="text-center">
              <p className="text-xl font-black" style={{ color: fg }}>{config.brand_name}</p>
              {config.tagline && <p className="text-sm mt-1 opacity-65" style={{ color: fg }}>{config.tagline}</p>}
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="bg-white rounded-2xl p-3 shadow-xl">
              {qrSrc
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={qrSrc} alt="Scan" width={210} height={210} />
                : <div className="w-[210px] h-[210px] flex items-center justify-center"><Loader2 size={28} className="animate-spin text-gray-400" /></div>}
            </div>
            <div className="text-center" style={{ color: fg }}>
              <p className="text-lg font-bold">📱 Scan to get your photo</p>
              <p className="text-xs mt-1 opacity-60">Enter WhatsApp to receive it</p>
            </div>
          </div>

          <div className="w-full space-y-2">
            <p className="text-center text-xs opacity-40" style={{ color: fg }}>New photo in {resetTimer}s</p>
            <button onClick={resetToAttract}
              className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95"
              style={{ background: fg + '1a', color: fg, border: `1.5px solid ${fg}44` }}>
              ↩ Take Another Photo
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
