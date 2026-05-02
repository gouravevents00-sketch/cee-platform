import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['director', 'accounts'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { type, event_id, client_id, vendor_id } = await req.json()

  // Return existing token if already generated for this combo
  let query = supabase.from('portal_tokens')
    .select('token')
    .eq('type', type)
    .eq('event_id', event_id)

  if (type === 'client' && client_id) query = query.eq('client_id', client_id)
  if (type === 'vendor' && vendor_id) query = query.eq('vendor_id', vendor_id)

  const { data: existing } = await query.maybeSingle()
  if (existing) return NextResponse.json({ token: existing.token })

  // Create new token
  const insert: any = { type, event_id, created_by: user.id }
  if (type === 'client' && client_id) insert.client_id = client_id
  if (type === 'vendor' && vendor_id) insert.vendor_id = vendor_id

  const { data, error } = await supabase.from('portal_tokens').insert(insert).select('token').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ token: data.token })
}
