import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/brief — Director generates a brief request link
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'director') {
    return NextResponse.json({ error: 'Director only' }, { status: 403 })
  }

  const body = await req.json()
  const { event_id, client_name, client_phone, client_email, event_type, event_date, city } = body

  const { data, error } = await supabase
    .from('brief_tokens')
    .insert({
      event_id: event_id || null,
      client_name: client_name || null,
      client_phone: client_phone || null,
      client_email: client_email || null,
      prefilled_event_type: event_type || null,
      prefilled_date: event_date || null,
      prefilled_city: city || null,
      created_by: user.id,
    })
    .select('token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cee-platform.vercel.app'
  const link = `${baseUrl}/brief/${data.token}`

  return NextResponse.json({ token: data.token, link })
}
