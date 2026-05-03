import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('artwork_tasks')
    .select('*, assignee:profiles!artwork_tasks_assigned_to_fkey(id, name), element:elements!artwork_tasks_element_id_fkey(id, name)')
    .eq('event_id', id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, brief, assigned_to, element_id } = body

  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const { data, error } = await supabase
    .from('artwork_tasks')
    .insert({ event_id: id, title, brief, assigned_to: assigned_to || null, element_id: element_id || null, created_by: user.id })
    .select('*, assignee:profiles!artwork_tasks_assigned_to_fkey(id, name), element:elements!artwork_tasks_element_id_fkey(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify assigned designer
  if (assigned_to) {
    await supabase.from('notifications').insert({
      user_id: assigned_to,
      title: 'New Artwork Task',
      body: `You have been assigned: ${title}`,
      link: `/dashboard/events/${id}/artwork`,
    })
  }

  return NextResponse.json(data)
}
