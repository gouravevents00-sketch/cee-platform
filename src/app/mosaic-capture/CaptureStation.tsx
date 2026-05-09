'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Camera, Loader2, RefreshCw, LayoutGrid } from 'lucide-react'

type Stage = 'loading' | 'attract' | 'countdown' | 'uploading' | 'result' | 'error' | 'full' | 'no-session'

interface MosaicSession {
  id: string
  brand_name: string
  tagline: string
  primary_color: string
  secondary_color: string
  logo_data_url: string | null
  master_image_url: string | null
  grid_cols: number
  grid_rows: number
}

const COUNTDOWN_FROM = 3
const CAPTURE_SIZE = 512
const AUTO_RESET_SECS = 25

function adjustColor(hex: string, amount: number): string {
  const c = hex.replace('#', '')
  if (c.length !== 6) return hex
  const r = Math.max(0, Math.min(255, parseInt(c.slice(0, 2), 16) + amount))
  const g = Math.max(0, Math.min(255, parseInt(c.slice(2, 4), 16) + amount))
  const b = Math.max(0, Math.min(255, parseInt(c.slice(4, 6), 16) + amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export default function CaptureStation() {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const resetRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  const [stage, setStage]           = useState<Stage>('loading')
  const [session, setSession]       = useState<MosaicSession | null>(null)
  const [countdown, setCountdown]   = useState(COUNTDOWN_FROM)
  const [resetTimer, setResetTimer] = useState(AUTO_RESET_SECS)
  const [errorMsg, setErrorMsg]     = useState('')
  const [tileResult, setTileResult] = useState<{ tile_x: number; tile_y: number; filled: number; total: number } | null>(null)
  const [tileCount, setTileCount]   = useState(0)

  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')

  useEffect(() => {
    if (!sessionId) { setStage('no-session'); return }
    Promise.all([
      fetch(`/api/mosaic/sessions/${sessionId}`).then(r => r.json()),
      fetch(`/api/mosaic/sessions/${sessionId}/tiles`).then(r => r.json()),
    ]).then(([{ session: s }, { tiles }]) => {
      if (!s) { setStage('no-session'); return }
      setSession(s)
      setTileCount(tiles?.length ?? 0)
      if ((tiles?.length ?? 0) >= s.grid_cols * s.grid_rows) {
        setStage('full')
      } else {
        setStage('attract')
      }
    }).catch(() => setStage('no-session'))
  }, [sessionId])

  useEffect(() => {
    if (stage !== 'countdown') return
    if (streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [stage])

  useEffect(() => {
    if (stage !== 'result') return
    setResetTimer(AUTO_RESET_SECS)
    const interval = setInterval(() => {
      setResetTimer(p => {
        if (p <= 1) { clearInterval(interval); resetToAttract(); return AUTO_RESET_SECS }
        return p - 1
      })
    }, 1000)
    resetRef.current = interval
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  function resetToAttract() {
    if (resetRef.current) clearInterval(resetRef.current)
    stopCamera()
    setTileResult(null); setErrorMsg('')
    setCountdown(COUNTDOWN_FROM)
    setStage('attract')
  }

  async function handleStart() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      setStage('countdown')
      let n = COUNTDOWN_FROM
      const t = setInterval(async () => {
        n--; setCountdown(n)
        if (n <= 0) { clearInterval(t); await captureAndUpload() }
      }, 1000)
    } catch {
      setErrorMsg('Camera not accessible. Please allow camera permission.')
      setStage('error')
    }
  }

  async function captureAndUpload() {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video || !session) return

    canvas.width = canvas.height = CAPTURE_SIZE
    const ctx = canvas.getContext('2d')!
    const vw = video.videoWidth, vh = video.videoHeight
    const size = Math.min(vw, vh)
    ctx.translate(CAPTURE_SIZE, 0); ctx.scale(-1, 1)
    ctx.drawImage(video, (vw - size) / 2, (vh - size) / 2, size, size, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE)
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
    stopCamera()
    setStage('uploading')

    try {
      // Upload photo
      const upRes = await fetch('/api/mosaic/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64, session_id: session.id, bucket: 'photos' }),
      })
      const { url, error: upErr } = await upRes.json()
      if (upErr || !url) throw new Error(upErr ?? 'Upload failed')

      // Assign tile
      const tileRes = await fetch(`/api/mosaic/sessions/${session.id}/tiles`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_url: url }),
      })
      const { tile, filled, total, error: tileErr } = await tileRes.json()
      if (tileErr) throw new Error(tileErr)

      setTileResult({ tile_x: tile.tile_x, tile_y: tile.tile_y, filled, total })
      setTileCount(filled)
      setStage('result')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStage('error')
    }
  }

  // ── Screens ──

  if (stage === 'loading') {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-indigo-400" />
      </div>
    )
  }

  if (stage === 'no-session') {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <LayoutGrid size={48} className="text-gray-600" />
        <p className="text-white text-xl font-bold">No Mosaic Session Found</p>
        <p className="text-gray-500 text-sm max-w-xs">Launch from the CEE Platform operator panel with a valid session ID.</p>
      </div>
    )
  }

  if (stage === 'full' && session) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 text-center"
        style={{ background: session.primary_color }}>
        <LayoutGrid size={56} style={{ color: session.secondary_color }} />
        <p className="text-3xl font-black" style={{ color: session.secondary_color }}>Mosaic Complete!</p>
        <p className="text-lg opacity-70" style={{ color: session.secondary_color }}>
          All {session.grid_cols * session.grid_rows} tiles have been filled. Thank you!
        </p>
      </div>
    )
  }

  if (stage === 'error') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center"
        style={{ background: session?.primary_color ?? '#0f172a' }}>
        <p className="text-white text-2xl font-bold">Something went wrong</p>
        <p className="text-white/60 text-sm max-w-sm">{errorMsg}</p>
        <button onClick={resetToAttract}
          className="flex items-center gap-2 px-8 py-4 bg-white/15 hover:bg-white/25 text-white rounded-2xl font-bold">
          <RefreshCw size={18} /> Try Again
        </button>
      </div>
    )
  }

  if (stage === 'attract' && session) {
    const bg = session.primary_color
    const fg = session.secondary_color
    const total = session.grid_cols * session.grid_rows
    const pct = Math.round((tileCount / total) * 100)

    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center select-none overflow-hidden cursor-pointer"
        style={{ background: `linear-gradient(145deg, ${bg} 0%, ${adjustColor(bg, -40)} 100%)` }}
        onClick={handleStart}>
        {/* Rings */}
        {[260, 440, 620].map((s, i) => (
          <div key={i} className="absolute rounded-full border pointer-events-none"
            style={{ width: s, height: s, borderColor: fg, opacity: 0.07,
              animation: `ping ${2.5 + i * 0.6}s cubic-bezier(0,0,0.2,1) infinite`,
              animationDelay: `${i * 0.5}s` }} />
        ))}

        {session.logo_data_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.logo_data_url} alt="" className="w-40 h-28 object-contain mb-6 drop-shadow-2xl" />
        )}

        <h1 className="text-6xl font-black text-center px-8 mb-3 leading-none" style={{ color: fg }}>
          {session.brand_name || 'Photo Mosaic'}
        </h1>
        {session.tagline && (
          <p className="text-xl text-center px-8 mb-8" style={{ color: fg, opacity: 0.65 }}>{session.tagline}</p>
        )}

        {/* Progress indicator */}
        <div className="flex flex-col items-center gap-2 mb-10">
          <div className="w-64 h-2 rounded-full overflow-hidden" style={{ background: fg + '33' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: fg }} />
          </div>
          <p className="text-sm" style={{ color: fg, opacity: 0.55 }}>{tileCount} of {total} tiles filled</p>
        </div>

        <div className="flex items-center gap-3 px-12 py-6 rounded-3xl text-2xl font-black shadow-2xl active:scale-95"
          style={{ background: fg, color: bg }}>
          <Camera size={28} /> Tap to Join the Mosaic
        </div>

        <p className="absolute bottom-6 text-xs tracking-widest uppercase" style={{ color: fg, opacity: 0.3 }}>
          Powered by Creative Era Experiences
        </p>
      </div>
    )
  }

  if (stage === 'countdown' && session) {
    const fg = session.secondary_color
    return (
      <div className="fixed inset-0" style={{ background: '#000' }}>
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }} muted playsInline autoPlay />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <div className="text-[220px] font-black leading-none drop-shadow-2xl" style={{ color: fg }}>
            {countdown > 0 ? countdown : '✨'}
          </div>
        </div>
        <div className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 rounded-2xl"
          style={{ background: session.primary_color + 'ee' }}>
          {session.logo_data_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.logo_data_url} alt="" className="h-8 w-auto object-contain" />
          )}
          <span className="text-sm font-bold" style={{ color: fg }}>{session.brand_name}</span>
        </div>
      </div>
    )
  }

  if (stage === 'uploading' && session) {
    const fg = session.secondary_color
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6"
        style={{ background: `linear-gradient(145deg, ${session.primary_color} 0%, ${adjustColor(session.primary_color, -40)} 100%)` }}>
        <Loader2 size={64} className="animate-spin" style={{ color: fg }} />
        <p className="text-2xl font-bold" style={{ color: fg }}>Adding you to the mosaic…</p>
      </div>
    )
  }

  if (stage === 'result' && session && tileResult) {
    const bg = session.primary_color
    const fg = session.secondary_color
    const pct = Math.round((tileResult.filled / tileResult.total) * 100)
    const qrUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/mosaic-display?session=${session.id}`
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=000000&bgcolor=ffffff&data=${encodeURIComponent(qrUrl)}`

    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-8 p-8"
        style={{ background: `linear-gradient(145deg, ${bg} 0%, ${adjustColor(bg, -40)} 100%)` }}>
        <canvas ref={canvasRef} className="hidden" />

        {/* Big checkmark */}
        <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
          style={{ background: fg + '22', border: `2px solid ${fg}44` }}>
          ✅
        </div>

        <div className="text-center" style={{ color: fg }}>
          <p className="text-3xl font-black mb-2">You're in the Mosaic!</p>
          <p className="text-lg opacity-70">
            You filled tile ({tileResult.tile_x + 1}, {tileResult.tile_y + 1})
          </p>
        </div>

        {/* Mosaic progress */}
        <div className="w-full max-w-xs space-y-2">
          <div className="flex justify-between text-sm" style={{ color: fg }}>
            <span className="opacity-60">Mosaic progress</span>
            <span className="font-bold">{tileResult.filled}/{tileResult.total}</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: fg + '33' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: fg }} />
          </div>
        </div>

        {/* QR to see the wall */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white rounded-2xl p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt="View wall" width={180} height={180} />
          </div>
          <p className="text-sm text-center" style={{ color: fg, opacity: 0.7 }}>
            Scan to see the live mosaic wall
          </p>
        </div>

        <div className="w-full max-w-xs space-y-1">
          <p className="text-center text-xs opacity-40" style={{ color: fg }}>Next photo in {resetTimer}s</p>
          <button onClick={resetToAttract}
            className="w-full py-3 rounded-2xl font-bold text-sm"
            style={{ background: fg + '1a', color: fg, border: `1px solid ${fg}33` }}>
            ↩ Next Guest
          </button>
        </div>
      </div>
    )
  }

  return null
}
