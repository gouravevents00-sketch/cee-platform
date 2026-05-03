import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('event_team')
    .select('*, member:profiles!event_team_user_id_fkey(id, name, role)')
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
  const { user_id, freelancer_name, role_in_event, department, is_freelancer, notes } = body

  if (!is_freelancer && !user_id) {
    return NextResponse.json({ error: 'user_id required for internal staff' }, { status: 400 })
  }
  if (is_freelancer && !freelancer_name?.trim()) {
    return NextResponse.json({ error: 'freelancer_name required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('event_team')
    .insert({ event_id: id, user_id: user_id || null, freelancer_name, role_in_event, department, is_freelancer: !!is_freelancer, notes })
    .select('*, member:profiles!event_team_user_id_fkey(id, name, role)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('memberId')
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  const { error } = await supabase.from('event_team').delete().eq('id', memberId).eq('event_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
