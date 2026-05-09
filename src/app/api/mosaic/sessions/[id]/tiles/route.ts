import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const svc = createServiceClient()

  const [{ data: session }, { data: tiles }] = await Promise.all([
    svc.from('mosaic_sessions').select('*').eq('id', id).single(),
    svc.from('mosaic_tiles').select('*').eq('session_id', id).order('created_at'),
  ])

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  return NextResponse.json({ session, tiles: tiles ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { photo_url, name, phone } = await req.json()
  if (!photo_url) return NextResponse.json({ error: 'photo_url required' }, { status: 400 })

  const svc = createServiceClient()

  // Get session grid config
  const { data: session } = await svc
    .from('mosaic_sessions')
    .select('grid_cols, grid_rows')
    .eq('id', id)
    .single()
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // Get all occupied tiles
  const { data: existing } = await svc
    .from('mosaic_tiles')
    .select('tile_x, tile_y')
    .eq('session_id', id)

  const occupied = new Set((existing ?? []).map(t => `${t.tile_x},${t.tile_y}`))
  const total = session.grid_cols * session.grid_rows

  if (occupied.size >= total) {
    return NextResponse.json({ error: 'Mosaic is complete — all tiles filled!' }, { status: 409 })
  }

  // Find next empty tile (fill in a spiral-ish pattern: center-out)
  // Simple approach: sequential row-by-row but we shuffle to make it look more natural
  const allPositions: { x: number; y: number }[] = []
  for (let y = 0; y < session.grid_rows; y++) {
    for (let x = 0; x < session.grid_cols; x++) {
      if (!occupied.has(`${x},${y}`)) {
        allPositions.push({ x, y })
      }
    }
  }

  // Pick a random position from available ones — creates a more natural fill pattern
  const pick = allPositions[Math.floor(Math.random() * allPositions.length)]

  const { data: tile, error } = await svc
    .from('mosaic_tiles')
    .insert({
      session_id: id,
      tile_x: pick.x,
      tile_y: pick.y,
      photo_url,
      name: name ?? null,
      phone: phone ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tile, filled: occupied.size + 1, total })
}
