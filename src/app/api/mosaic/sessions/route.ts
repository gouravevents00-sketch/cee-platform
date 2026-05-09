import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('mosaic_sessions')
    .select('id, name, brand_name, tagline, logo_data_url, primary_color, secondary_color, master_image_url, grid_cols, grid_rows, active, created_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('mosaic_sessions')
    .insert({
      name: body.name,
      brand_name: body.brand_name ?? '',
      tagline: body.tagline ?? '',
      logo_data_url: body.logo_data_url ?? null,
      primary_color: body.primary_color ?? '#0f172a',
      secondary_color: body.secondary_color ?? '#ffffff',
      master_image_url: body.master_image_url ?? null,
      grid_cols: body.grid_cols ?? 20,
      grid_rows: body.grid_rows ?? 12,
      active: true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data })
}
