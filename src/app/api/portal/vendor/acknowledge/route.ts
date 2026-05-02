import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { token } = await req.json()

  const { data: portalToken } = await supabase
    .from('portal_tokens')
    .select('event_id, vendor_id')
    .eq('token', token)
    .eq('type', 'vendor')
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!portalToken) return NextResponse.json({ error: 'Invalid link' }, { status: 403 })

  // Log acknowledgment as activity
  await supabase.from('activity_log').insert({
    event_id: portalToken.event_id,
    user_id: null,
    action: 'Vendor SO Acknowledged',
    detail: 'Vendor accepted the service order via portal',
  })

  // Notify directors
  await supabase.from('notifications').insert(
    (await supabase.from('profiles').select('id').eq('role', 'director')).data?.map(p => ({
      user_id: p.id,
      title: 'Vendor Acknowledged SO',
      body: 'A vendor has accepted their service order.',
      link: '/dashboard/events/' + portalToken.event_id,
    })) || []
  )

  return NextResponse.json({ ok: true })
}
