import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { token, approval_id, decision, comment } = await req.json()

  // Validate token
  const { data: portalToken } = await supabase
    .from('portal_tokens')
    .select('event_id, client_id')
    .eq('token', token)
    .eq('type', 'client')
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!portalToken) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 403 })

  // Verify approval belongs to this event
  const { data: approval } = await supabase
    .from('approvals')
    .select('id, event_id')
    .eq('id', approval_id)
    .eq('event_id', portalToken.event_id)
    .single()

  if (!approval) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (decision === 'approved') {
    // Mark approval as approved by client
    await supabase.from('approvals').update({
      status: 'approved',
      comment: comment ? `[Client Approved] ${comment}` : '[Client Approved]',
      decided_at: new Date().toISOString(),
    }).eq('id', approval_id)
  } else {
    // Send back for changes — insert a new approval request as "client feedback"
    await supabase.from('approvals').update({
      comment: comment ? `[Client: Changes Requested] ${comment}` : '[Client: Changes Requested]',
    }).eq('id', approval_id)
  }

  return NextResponse.json({ ok: true })
}
