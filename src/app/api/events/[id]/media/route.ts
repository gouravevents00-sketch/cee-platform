import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const body = await req.json()
  const { file_url, caption, media_type } = body
  if (!file_url?.trim()) return NextResponse.json({ error: 'file_url required' }, { status: 400 })

  const { data, error } = await supabase
    .from('event_media')
    .insert({ event_id: id, uploaded_by: user.id, file_url, caption, media_type: media_type || 'photo' })
    .select('*, uploader:profiles!event_media_uploaded_by_fkey(id, name, role)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify design team about new media
  const { data: designers } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'design')

  if (designers && designers.length > 0) {
    const { data: event } = await supabase.from('events').select('name').eq('id', id).single()
    await supabase.from('notifications').insert(
      designers.map((d: any) => ({
        user_id: d.id,
        title: 'New Event Media',
        body: `New ${media_type || 'photo'} uploaded for ${event?.name || 'event'} — ready for social content`,
        link: `/dashboard/events/${id}/media`,
      }))
    )
  }

  return NextResponse.json(data)
}
