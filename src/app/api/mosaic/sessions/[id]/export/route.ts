import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const svc = createServiceClient()
  const { data } = await svc
    .from('mosaic_tiles')
    .select('tile_x, tile_y, name, phone, photo_url, created_at')
    .eq('session_id', id)
    .order('created_at')

  const rows = data ?? []
  const csv = [
    'Tile X,Tile Y,Name,WhatsApp,Photo URL,Time',
    ...rows.map(r =>
      [`"${r.tile_x}"`, `"${r.tile_y}"`, `"${r.name ?? ''}"`, `"${r.phone ?? ''}"`,
       `"${r.photo_url}"`, `"${new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}"`
      ].join(',')
    ),
  ].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="mosaic-participants-${id}.csv"`,
    },
  })
}
