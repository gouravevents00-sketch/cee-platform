import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('leads')
    .select('*, assignee:profiles!leads_assigned_to_fkey(id, name), client:clients!leads_client_id_fkey(id, name)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, company, contact_name, contact_phone, contact_email, event_type, est_budget, source, assigned_to, follow_up_date, notes } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('leads')
    .insert({
      name, company, contact_name, contact_phone, contact_email,
      event_type, est_budget: est_budget || 0, source: source || 'referral',
      assigned_to: assigned_to || null,
      follow_up_date: follow_up_date || null,
      notes, created_by: user.id,
    })
    .select('*, assignee:profiles!leads_assigned_to_fkey(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
