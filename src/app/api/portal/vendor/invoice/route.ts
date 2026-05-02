import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const formData = await req.formData()
  const token = formData.get('token') as string
  const file = formData.get('file') as File

  if (!token || !file) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

  const { data: portalToken } = await supabase
    .from('portal_tokens')
    .select('event_id, vendor_id')
    .eq('token', token)
    .eq('type', 'vendor')
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!portalToken) return NextResponse.json({ error: 'Invalid link' }, { status: 403 })

  const ext = file.name.split('.').pop()
  const path = `vendor-invoices/${portalToken.event_id}/${portalToken.vendor_id}-${Date.now()}.${ext}`

  const { data: upload, error } = await supabase.storage.from('cee-files').upload(path, file)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: urlData } = supabase.storage.from('cee-files').getPublicUrl(path)

  // Update vendor payment with invoice URL if exists
  await supabase.from('vendor_payments')
    .update({ notes: 'Invoice submitted by vendor: ' + urlData.publicUrl })
    .eq('event_id', portalToken.event_id)
    .eq('vendor_id', portalToken.vendor_id)

  // Log + notify
  await supabase.from('activity_log').insert({
    event_id: portalToken.event_id,
    user_id: null,
    action: 'Vendor Invoice Submitted',
    detail: 'Invoice uploaded via vendor portal',
  })

  const { data: directors } = await supabase.from('profiles').select('id').eq('role', 'director')
  const { data: accounts } = await supabase.from('profiles').select('id').eq('role', 'accounts')
  const notifyUsers = [...(directors || []), ...(accounts || [])]

  if (notifyUsers.length > 0) {
    await supabase.from('notifications').insert(
      notifyUsers.map(p => ({
        user_id: p.id,
        title: 'Vendor Invoice Received',
        body: 'A vendor submitted their invoice. Review and process payment.',
        link: '/dashboard/events/' + portalToken.event_id + '/payments',
      }))
    )
  }

  return NextResponse.json({ ok: true, url: urlData.publicUrl })
}
