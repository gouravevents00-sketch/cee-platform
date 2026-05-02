'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Camera, RefreshCw, Download, Zap } from 'lucide-react'

type Stage = 'idle' | 'countdown' | 'captured' | 'generating' | 'result' | 'error'

const COUNTDOWN_FROM = 3
const CAPTURE_SIZE = 768  // px — sent to fal.ai

export default function SketchBooth() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [stage, setStage] = useState<Stage>('idle')
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM)
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null)
  const [sketchUrl, setSketchUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [genProgress, setGenProgress] = useState(0)
  const [genTime, setGenTime] = useState(0)

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setStage('idle')
    } catch {
      setErrorMsg('Camera access denied. Please allow camera permissions.')
      setStage('error')
    }
  }, [])

  useEffect(() => {
    startCamera()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [startCamera])

  // Countdown → capture
  const startCountdown = useCallback(() => {
    setStage('countdown')
    setCountdown(COUNTDOWN_FROM)
    let c = COUNTDOWN_FROM
    const interval = setInterval(() => {
      c -= 1
      setCountdown(c)
      if (c <= 0) {
        clearInterval(interval)
        capturePhoto()
      }
    }, 1000)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // Square crop from center, resize to CAPTURE_SIZE
    const vw = video.videoWidth
    const vh = video.videoHeight
    const size = Math.min(vw, vh)
    const sx = (vw - size) / 2
    const sy = (vh - size) / 2

    canvas.width = CAPTURE_SIZE
    canvas.height = CAPTURE_SIZE
    const ctx = canvas.getContext('2d')!
    ctx.save()
    // Mirror for selfie
    ctx.translate(CAPTURE_SIZE, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sx, sy, size, size, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE)
    ctx.restore()

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setCapturedDataUrl(dataUrl)
    setStage('captured')
  }, [])

  // Generate sketch
  const generateSketch = useCallback(async () => {
    if (!capturedDataUrl) return
    setStage('generating')
    setGenProgress(0)
    setGenTime(0)

    // Fake progress animation while waiting
    const start = Date.now()
    const progressInterval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000
      setGenTime(Math.round(elapsed))
      // Progress: fast first 50%, then slows down
      setGenProgress(prev => {
        if (prev < 50) return prev + 3
        if (prev < 80) return prev + 0.8
        if (prev < 92) return prev + 0.3
        return prev
      })
    }, 300)

    try {
      const base64 = capturedDataUrl.split(',')[1]
      const res = await fetch('/api/sketch/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64 }),
      })
      clearInterval(progressInterval)
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Generation failed')
      }
      const data = await res.json()
      setSketchUrl(data.sketch_url)
      setGenProgress(100)
      setGenTime(Math.round((Date.now() - start) / 1000))
      setStage('result')
    } catch (err: unknown) {
      clearInterval(progressInterval)
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStage('error')
    }
  }, [capturedDataUrl])

  // Reset everything
  const reset = useCallback(() => {
    setCapturedDataUrl(null)
    setSketchUrl(null)
    setErrorMsg('')
    setGenProgress(0)
    setGenTime(0)
    setStage('idle')
  }, [])

  const downloadSketch = useCallback(() => {
    if (!sketchUrl) return
    const a = document.createElement('a')
    a.href = sketchUrl
    a.download = `cee-sketch-${Date.now()}.jpg`
    a.click()
  }, [sketchUrl])

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-950 select-none overflow-hidden">

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center">
            <Zap size={16} className="text-black" />
          </div>
          <div>
            <p className="text-white text-sm font-bold leading-none">Draw Me Bot</p>
            <p className="text-gray-500 text-xs leading-none mt-0.5">Creative Era Experiences</p>
          </div>
        </div>
        {(stage === 'result' || stage === 'captured' || stage === 'error') && (
          <button onClick={reset}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            <RefreshCw size={14} />
            Try Again
          </button>
        )}
      </div>

      {/* Main area */}
      <div className="flex flex-col items-center w-full max-w-4xl px-6">

        {/* IDLE — Camera preview */}
        {(stage === 'idle' || stage === 'countdown') && (
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="relative">
              {/* Camera feed */}
              <div className="relative w-72 h-72 sm:w-96 sm:h-96 rounded-3xl overflow-hidden border-2 border-gray-800">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {/* Corner markers */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-amber-400 rounded-tl-lg" />
                  <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-amber-400 rounded-tr-lg" />
                  <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-amber-400 rounded-bl-lg" />
                  <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-amber-400 rounded-br-lg" />
                </div>
                {/* Countdown overlay */}
                {stage === 'countdown' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="text-amber-400 font-bold" style={{ fontSize: '8rem', lineHeight: 1, textShadow: '0 0 40px rgba(245,158,11,0.8)' }}>
                      {countdown > 0 ? countdown : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {stage === 'idle' && (
              <>
                <p className="text-gray-400 text-center text-sm">
                  Stand in front of the camera and hit the button
                </p>
                <button
                  onClick={startCountdown}
                  className="flex items-center gap-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold text-lg px-10 py-4 rounded-2xl transition-all shadow-lg shadow-amber-500/20">
                  <Camera size={22} />
                  Take My Photo
                </button>
              </>
            )}
            {stage === 'countdown' && (
              <p className="text-amber-400 text-xl font-semibold animate-pulse">
                {countdown > 0 ? 'Get ready...' : 'Smile!'}
              </p>
            )}
          </div>
        )}

        {/* CAPTURED — confirm photo */}
        {stage === 'captured' && capturedDataUrl && (
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="relative w-72 h-72 sm:w-96 sm:h-96 rounded-3xl overflow-hidden border-2 border-gray-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={capturedDataUrl} alt="Your photo" className="w-full h-full object-cover" />
            </div>
            <p className="text-gray-400 text-sm text-center">Looking good! Ready to sketch?</p>
            <div className="flex gap-3">
              <button onClick={reset}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-6 py-3 rounded-xl text-sm transition-colors">
                Retake
              </button>
              <button onClick={generateSketch}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20">
                <Zap size={18} />
                Generate Sketch
              </button>
            </div>
          </div>
        )}

        {/* GENERATING — progress */}
        {stage === 'generating' && (
          <div className="flex flex-col items-center gap-8 w-full max-w-sm">
            {/* Animated sketch lines */}
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 200 200" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 20px rgba(245,158,11,0.3))' }}>
                <path
                  d="M100,20 C130,20 150,40 150,100 C150,160 130,180 100,180 C70,180 50,160 50,100 C50,40 70,20 100,20"
                  fill="none" stroke="#f59e0b" strokeWidth="2"
                  strokeDasharray="400" strokeDashoffset="400"
                  style={{ animation: 'drawPath 2s ease-in-out infinite' }}
                />
                <path
                  d="M70,80 Q100,65 130,80"
                  fill="none" stroke="#f59e0b" strokeWidth="2"
                  strokeDasharray="100" strokeDashoffset="100"
                  style={{ animation: 'drawPath 2s ease-in-out infinite 0.3s' }}
                />
                <path
                  d="M80,110 Q100,125 120,110"
                  fill="none" stroke="#f59e0b" strokeWidth="2"
                  strokeDasharray="80" strokeDashoffset="80"
                  style={{ animation: 'drawPath 2s ease-in-out infinite 0.6s' }}
                />
                <circle cx="80" cy="85" r="5" fill="none" stroke="#f59e0b" strokeWidth="2"
                  style={{ animation: 'fadeIn 1s ease-in-out infinite 0.8s' }}
                />
                <circle cx="120" cy="85" r="5" fill="none" stroke="#f59e0b" strokeWidth="2"
                  style={{ animation: 'fadeIn 1s ease-in-out infinite 1s' }}
                />
              </svg>
            </div>

            <div className="text-center">
              <p className="text-white text-xl font-bold mb-1">Drawing your sketch...</p>
              <p className="text-gray-500 text-sm">{genTime}s elapsed</p>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${genProgress}%` }}
              />
            </div>
            <p className="text-amber-400 text-sm font-medium -mt-4">
              {genProgress < 30 ? 'Analyzing your photo...' :
               genProgress < 60 ? 'Creating line art...' :
               genProgress < 85 ? 'Refining strokes...' :
               'Almost done!'}
            </p>
          </div>
        )}

        {/* RESULT — show sketch + original */}
        {stage === 'result' && sketchUrl && capturedDataUrl && (
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="flex gap-4 w-full justify-center">
              {/* Original */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Photo</p>
                <div className="w-44 h-44 sm:w-56 sm:h-56 rounded-2xl overflow-hidden border border-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={capturedDataUrl} alt="Your photo" className="w-full h-full object-cover" />
                </div>
              </div>

              {/* Arrow */}
              <div className="flex items-center text-amber-400 text-2xl font-bold mt-8">→</div>

              {/* Sketch */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-amber-400 text-xs font-medium uppercase tracking-wider">Your Sketch</p>
                  <span className="text-gray-600 text-xs">({genTime}s)</span>
                </div>
                <div className="w-44 h-44 sm:w-56 sm:h-56 rounded-2xl overflow-hidden border-2 border-amber-500/40 shadow-lg shadow-amber-500/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sketchUrl} alt="Your sketch" className="w-full h-full object-cover bg-white" />
                </div>
              </div>
            </div>

            <p className="text-gray-400 text-sm text-center">
              The robot will now draw this on paper!
            </p>

            <div className="flex gap-3">
              <button onClick={downloadSketch}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-5 py-3 rounded-xl text-sm transition-colors">
                <Download size={15} />
                Save
              </button>
              <button onClick={reset}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold px-8 py-3 rounded-xl transition-all">
                <Camera size={18} />
                Next Person
              </button>
            </div>
          </div>
        )}

        {/* ERROR */}
        {stage === 'error' && (
          <div className="flex flex-col items-center gap-6 max-w-sm text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <span className="text-3xl">⚠️</span>
            </div>
            <div>
              <p className="text-white font-semibold text-lg mb-2">Something went wrong</p>
              <p className="text-gray-500 text-sm">{errorMsg}</p>
            </div>
            <button onClick={reset}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 py-3 rounded-xl transition-all">
              <RefreshCw size={16} />
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      <style>{`
        @keyframes drawPath {
          0% { stroke-dashoffset: 400; opacity: 0.3; }
          50% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: -400; opacity: 0.3; }
        }
        @keyframes fadeIn {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
