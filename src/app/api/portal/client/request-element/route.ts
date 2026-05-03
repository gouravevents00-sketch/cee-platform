import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { token, name, specs, quantity, notes } = await req.json()

  if (!token || !name) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

  const { data: portalToken } = await supabase
    .from('portal_tokens')
    .select('event_id, client_id')
    .eq('token', token)
    .eq('type', 'client')
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!portalToken) return NextResponse.json({ error: 'Invalid link' }, { status: 403 })

  const { data: event } = await supabase
    .from('events')
    .select('name, clients(name)')
    .eq('id', portalToken.event_id)
    .single()

  // Add element with status 'additional' and note indicating client request
  await supabase.from('elements').insert({
    event_id: portalToken.event_id,
    name,
    specs: specs || null,
    quantity: quantity || 1,
    notes: `CLIENT REQUEST${notes ? ': ' + notes : ''}`,
    status: 'additional',
  })

  // Notify director + admin
  const { data: staffToNotify } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['director', 'admin'])

  if (staffToNotify && staffToNotify.length > 0) {
    const clientName = (event?.clients as any)?.name || 'Client'
    await supabase.from('notifications').insert(
      staffToNotify.map((p: any) => ({
        user_id: p.id,
        title: `Element Request: ${event?.name}`,
        body: `${clientName} requested: "${name}"${specs ? ` — ${specs}` : ''} (Qty: ${quantity || 1})`,
        link: `/dashboard/events/${portalToken.event_id}/elements`,
      }))
    )
  }

  return NextResponse.json({ ok: true })
}
