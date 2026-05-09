import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const config_id = req.nextUrl.searchParams.get('config_id')
  const svc = createServiceClient()
  let query = svc
    .from('activation_leads')
    .select('*')
    .order('created_at', { ascending: false })
  if (config_id) query = query.eq('config_id', config_id)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leads: data })
}

export async function POST(req: NextRequest) {
  const { config_id, name, phone, photo_url, rating } = await req.json()
  if (!name || !phone) return NextResponse.json({ error: 'name and phone required' }, { status: 400 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('activation_leads')
    .insert({ config_id: config_id || null, name, phone, photo_url: photo_url || null, rating: rating || null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lead: data })
}
