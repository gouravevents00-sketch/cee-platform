'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

interface Tile {
  tile_x: number
  tile_y: number
  photo_url: string
  name: string | null
}

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

const POLL_MS = 4000

export default function MosaicDisplay() {
  const [session, setSession]   = useState<MosaicSession | null>(null)
  const [tiles, setTiles]       = useState<Tile[]>([])
  const [loading, setLoading]   = useState(true)
  const [newTileKey, setNewTileKey] = useState<string | null>(null)
  const prevTileCount = useRef(0)
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')

  async function fetchData() {
    if (!sessionId) return
    try {
      const res = await fetch(`/api/mosaic/sessions/${sessionId}/tiles`)
      const { session: s, tiles: t } = await res.json()
      setSession(s)
      setTiles(t ?? [])
      // Detect new tile for highlight animation
      if ((t?.length ?? 0) > prevTileCount.current && prevTileCount.current > 0) {
        const newest = t[t.length - 1]
        setNewTileKey(`${newest.tile_x},${newest.tile_y}`)
        setTimeout(() => setNewTileKey(null), 2000)
      }
      prevTileCount.current = t?.length ?? 0
    } catch {/* silent */}
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, POLL_MS)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  if (loading || !session) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center">
        <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const { grid_cols: cols, grid_rows: rows } = session
  const total = cols * rows
  const filled = tiles.length
  const pct = Math.round((filled / total) * 100)
  const fg = session.secondary_color
  const bg = session.primary_color

  // Build tile map
  const tileMap: Record<string, Tile> = {}
  tiles.forEach(t => { tileMap[`${t.tile_x},${t.tile_y}`] = t })

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: bg }}>

      {/* Mosaic Grid — takes 85% of height */}
      <div className="flex-1 overflow-hidden relative">
        {/* Master image background (always visible underneath) */}
        {session.master_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.master_image_url}
            alt="Master"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 1 }}
          />
        )}

        {/* Guest photo grid overlay */}
        <div
          className="absolute inset-0"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
        >
          {Array.from({ length: rows }, (_, y) =>
            Array.from({ length: cols }, (_, x) => {
              const key = `${x},${y}`
              const tile = tileMap[key]
              const isNew = newTileKey === key

              return (
                <div
                  key={key}
                  className="relative overflow-hidden"
                  style={{
                    // Thin grid lines visible on empty tiles
                    outline: tile ? 'none' : `0.5px solid ${fg}0a`,
                  }}
                >
                  {tile && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tile.photo_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{
                        opacity: isNew ? 1 : 0.82,
                        transition: 'opacity 1.2s ease',
                        // On new tile: brief white flash
                        filter: isNew ? 'brightness(1.4)' : 'brightness(1)',
                      }}
                    />
                  )}
                  {/* New tile pulse ring */}
                  {isNew && (
                    <div className="absolute inset-0 border-4 border-white animate-ping pointer-events-none" style={{ opacity: 0.8 }} />
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Bottom bar — brand info + progress */}
      <div className="flex items-center gap-6 px-8 py-4 flex-shrink-0" style={{ background: bg + 'f5' }}>
        {/* Logo */}
        {session.logo_data_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.logo_data_url} alt="" className="h-12 w-auto object-contain flex-shrink-0" />
        )}

        {/* Brand + tagline */}
        <div className="flex-shrink-0">
          <p className="text-xl font-black leading-none" style={{ color: fg }}>{session.brand_name}</p>
          {session.tagline && <p className="text-sm mt-0.5 opacity-60" style={{ color: fg }}>{session.tagline}</p>}
        </div>

        {/* Progress bar — center */}
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="h-3 rounded-full overflow-hidden" style={{ background: fg + '25' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: fg }}
            />
          </div>
          <p className="text-xs" style={{ color: fg, opacity: 0.55 }}>
            {filled} of {total} tiles filled · {pct}% complete
          </p>
        </div>

        {/* Counter */}
        <div className="text-right flex-shrink-0">
          <p className="text-4xl font-black leading-none" style={{ color: fg }}>{filled}</p>
          <p className="text-xs mt-0.5" style={{ color: fg, opacity: 0.5 }}>guests</p>
        </div>
      </div>
    </div>
  )
}
