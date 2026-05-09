import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('brand_activation_configs')
    .select('id, name, brand_name, tagline, primary_color, secondary_color, frame_style, active, sort_order, created_at')
    .order('sort_order', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ configs: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('brand_activation_configs')
    .insert({
      name: body.name,
      brand_name: body.brand_name,
      tagline: body.tagline ?? '',
      primary_color: body.primary_color ?? '#1a1a2e',
      secondary_color: body.secondary_color ?? '#ffffff',
      logo_data_url: body.logo_data_url ?? null,
      frame_style: body.frame_style ?? 'strip',
      active: body.active ?? true,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}
