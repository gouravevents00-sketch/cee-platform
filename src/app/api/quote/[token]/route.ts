import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

// GET — load quotation data for client view
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: tokenRow, error } = await supabase
    .from('quotation_tokens')
    .select('id, quotation_id, event_id, status, viewed_at, decided_at, client_decision, expires_at')
    .eq('token', token)
    .single()

  if (error || !tokenRow) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const expires = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null
  if (expires && expires < new Date()) return NextResponse.json({ error: 'expired' }, { status: 410 })

  // Mark as viewed
  if (!tokenRow.viewed_at) {
    await supabase.from('quotation_tokens').update({ viewed_at: new Date().toISOString() }).eq('token', token)
  }

  // Fetch quotation
  const { data: quot } = await supabase
    .from('quotations')
    .select('*, events(name, event_date, venue, city, clients(name, contact_name, contact_phone, contact_email))')
    .eq('id', tokenRow.quotation_id)
    .single()

  if (!quot) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ quot, tokenStatus: tokenRow.status, clientDecision: tokenRow.client_decision })
}

// POST — client submits decision (accept / changes)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createServiceClient()

  const { decision, note } = await req.json()
  if (!['accepted', 'changes_requested'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  const { data: tokenRow } = await supabase
    .from('quotation_tokens')
    .select('id, quotation_id, event_id, status')
    .eq('token', token)
    .single()

  if (!tokenRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (tokenRow.status !== 'pending' && tokenRow.status !== 'viewed') {
    return NextResponse.json({ error: 'Already decided' }, { status: 400 })
  }

  await supabase.from('quotation_tokens').update({
    status: decision,
    client_decision: decision,
    client_note: note || null,
    decided_at: new Date().toISOString(),
  }).eq('token', token)

  // Update quotation status
  const newStatus = decision === 'accepted' ? 'accepted' : 'negotiating'
  await supabase.from('quotations').update({ status: newStatus }).eq('id', tokenRow.quotation_id)

  // Notify directors
  const { data: directors } = await supabase.from('profiles').select('id').eq('role', 'director')
  if (directors?.length && tokenRow.event_id) {
    const { data: ev } = await supabase.from('events').select('name').eq('id', tokenRow.event_id).single()
    await supabase.from('notifications').insert(
      directors.map(d => ({
        user_id: d.id,
        title: decision === 'accepted' ? 'Quotation Accepted!' : 'Client Requested Changes',
        body: decision === 'accepted'
          ? `${ev?.name || 'Event'} quotation accepted by client.${note ? ` Note: "${note}"` : ''}`
          : `${ev?.name || 'Event'}: Client requested changes.${note ? ` "${note}"` : ''}`,
        link: `/dashboard/events/${tokenRow.event_id}/quotation`,
      }))
    )
  }

  return NextResponse.json({ success: true })
}
