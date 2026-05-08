import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { autoCompleteTasks, KEYWORDS_EVENT_CREATED } from '@/lib/autoCompleteTasks'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'director') return NextResponse.json({ error: 'Director only' }, { status: 403 })

  const { data: lead } = await supabase.from('leads').select('*').eq('id', id).single()
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  // Create client record from lead contact info
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      name: lead.company || lead.contact_name || lead.name,
      type: 'corporate',
      contact_name: lead.contact_name || '',
      contact_phone: lead.contact_phone || '',
      contact_email: lead.contact_email || '',
      advance_percent: 50,
      credit_period_days: 30,
    })
    .select('id')
    .single()

  if (clientError) return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })

  // Create event from lead data
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      name: lead.name,
      client_id: client.id,
      type: lead.event_type || '',
      city: '',
      event_date: null,
      current_phase: 0,
      status: 'enquiry',
      created_by: user.id,
      notes: lead.notes || '',
    })
    .select('id')
    .single()

  if (eventError) return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })

  // Auto-create all 30 tasks
  await supabase.rpc('create_event_tasks', { p_event_id: event.id })

  // Auto-complete Phase 0 enquiry tasks — brief received, group created, team briefed
  await autoCompleteTasks(
    supabase, event.id, user.id, KEYWORDS_EVENT_CREATED,
    'Auto-completed: Event created from client brief inquiry.'
  )

  // Link lead to client and mark as proposal_sent
  await supabase.from('leads').update({
    client_id: client.id,
    status: 'proposal_sent',
  }).eq('id', id)

  await supabase.from('activity_log').insert({
    event_id: event.id,
    user_id: user.id,
    action: 'Event Created',
    detail: `Event created from brief inquiry — ${lead.name}`,
  })

  return NextResponse.json({ event_id: event.id })
}
