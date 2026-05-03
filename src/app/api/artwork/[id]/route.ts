import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['status', 'file_url', 'revision_notes', 'assigned_to', 'brief']
  const patch: Record<string, any> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  // Increment revision_count when going back to revision
  if (patch.status === 'revision') {
    const { data: existing } = await supabase.from('artwork_tasks').select('revision_count').eq('id', id).single()
    patch.revision_count = (existing?.revision_count || 0) + 1
  }

  const { data, error } = await supabase
    .from('artwork_tasks')
    .update(patch)
    .eq('id', id)
    .select('*, assignee:profiles!artwork_tasks_assigned_to_fkey(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('artwork_tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
