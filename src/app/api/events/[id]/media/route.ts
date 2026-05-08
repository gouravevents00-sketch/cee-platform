import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('event_media')
    .select('*, uploader:profiles!event_media_uploaded_by_fkey(id, name, role)')
    .eq('event_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let file_url: string
  let caption = ''
  let media_type = 'photo'
  let element_tag = ''

  const ct = req.headers.get('content-type') || ''

  if (ct.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    caption = (formData.get('caption') as string) || ''
    media_type = (formData.get('media_type') as string) || 'photo'
    element_tag = (formData.get('element_tag') as string) || ''

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('event-media')
      .upload(path, arrayBuffer, { contentType: file.type })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: publicData } = supabase.storage.from('event-media').getPublicUrl(path)
    file_url = publicData.publicUrl
  } else {
    const body = await req.json()
    file_url = body.file_url
    caption = body.caption || ''
    media_type = body.media_type || 'photo'
    if (!file_url?.trim()) return NextResponse.json({ error: 'file_url required' }, { status: 400 })
  }

  const captionFinal = element_tag
    ? `[${element_tag}]${caption ? ' ' + caption : ''}`
    : caption

  const { data, error } = await supabase
    .from('event_media')
    .insert({ event_id: id, uploaded_by: user.id, file_url, caption: captionFinal, media_type })
    .select('*, uploader:profiles!event_media_uploaded_by_fkey(id, name, role)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: designers } = await supabase.from('profiles').select('id').eq('role', 'design')
  if (designers && designers.length > 0) {
    const { data: event } = await supabase.from('events').select('name').eq('id', id).single()
    await supabase.from('notifications').insert(
      designers.map((d: any) => ({
        user_id: d.id,
        title: 'New Event Media',
        body: `New ${media_type} uploaded for ${event?.name || 'event'} — ready for social content`,
        link: `/dashboard/events/${id}/media`,
      }))
    )
  }

  return NextResponse.json(data)
}
