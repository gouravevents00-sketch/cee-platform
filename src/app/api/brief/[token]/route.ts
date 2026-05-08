import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

// GET /api/brief/[token] — Load form data (public)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('brief_tokens')
    .select('id, client_name, client_phone, client_email, prefilled_event_type, prefilled_date, prefilled_city, status, filled_at, expires_at')
    .eq('token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  if (data.status === 'filled') return NextResponse.json({ error: 'already_filled', data }, { status: 200 })

  const expires = data.expires_at ? new Date(data.expires_at) : null
  if (expires && expires < new Date()) {
    return NextResponse.json({ error: 'This form link has expired.' }, { status: 410 })
  }

  return NextResponse.json({ data })
}

// POST /api/brief/[token] — Client submits brief (public, no auth)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const contentType = req.headers.get('content-type') || ''
  let briefData: Record<string, any> = {}
  let uploadedFileName: string | null = null

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const jsonStr = formData.get('brief_data') as string | null
    if (jsonStr) {
      try { briefData = JSON.parse(jsonStr) } catch {}
    }
    if (file) {
      uploadedFileName = file.name
      // Store file content as base64 in brief_data for later AI parsing
      const bytes = await file.arrayBuffer()
      const base64 = Buffer.from(bytes).toString('base64')
      briefData._uploaded_file = {
        name: file.name,
        type: file.type,
        base64,
      }
    }
  } else {
    briefData = await req.json()
  }

  // Use service client to bypass RLS for anonymous submission
  const supabase = createServiceClient()

  // Check token exists and not already filled
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('brief_tokens')
    .select('id, event_id, status, expires_at')
    .eq('token', token)
    .single()

  if (tokenErr || !tokenRow) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }
  if (tokenRow.status === 'filled') {
    return NextResponse.json({ error: 'Already submitted' }, { status: 400 })
  }
  const expires = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null
  if (expires && expires < new Date()) {
    return NextResponse.json({ error: 'Form link expired' }, { status: 410 })
  }

  // Update token with submitted data
  const { error: updateErr } = await supabase
    .from('brief_tokens')
    .update({
      brief_data: briefData,
      uploaded_file_name: uploadedFileName,
      status: 'filled',
      filled_at: new Date().toISOString(),
      // Update client contact info if provided
      client_name: briefData.client_name || undefined,
      client_phone: briefData.client_phone || undefined,
      client_email: briefData.client_email || undefined,
    })
    .eq('token', token)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // If linked to an event, update event notes with brief summary
  if (tokenRow.event_id && briefData.requirements) {
    await supabase
      .from('events')
      .update({ notes: typeof briefData.requirements === 'string' ? briefData.requirements : JSON.stringify(briefData.requirements) })
      .eq('id', tokenRow.event_id)
  }

  // Notify directors
  const { data: directors } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'director')

  if (directors?.length) {
    await supabase.from('notifications').insert(
      directors.map(d => ({
        user_id: d.id,
        title: 'Client Brief Submitted',
        body: `${briefData.client_name || 'Client'} has submitted their event brief. Review and build quotation.`,
        link: tokenRow.event_id ? `/dashboard/events/${tokenRow.event_id}/quotation` : '/dashboard/events',
      }))
    )
  }

  return NextResponse.json({ success: true })
}
