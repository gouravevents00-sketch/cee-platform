import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'director') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { event_date, poc_id, reason } = body

  const updates: Record<string, any> = {}
  if (event_date !== undefined) updates.event_date = event_date
  if (poc_id !== undefined) updates.poc_id = poc_id

  const { data: event, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select('id, name, event_date, poc_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  try {
    await supabase.from('activity_log').insert({
      event_id: id,
      user_id: user.id,
      action: event_date ? 'event_date_changed' : 'poc_replaced',
      details: reason || (event_date ? `Date changed to ${event_date}` : 'POC replaced'),
    })
  } catch {}

  // Notify event team on date change
  if (event_date) {
    const { data: teamMembers } = await supabase
      .from('event_team')
      .select('user_id')
      .eq('event_id', id)
      .not('user_id', 'is', null)

    const { data: pocProfile } = await supabase
      .from('events')
      .select('poc_id')
      .eq('id', id)
      .single()

    const notifyIds = new Set<string>()
    teamMembers?.forEach((m: any) => { if (m.user_id) notifyIds.add(m.user_id) })
    if (pocProfile?.poc_id) notifyIds.add(pocProfile.poc_id)

    if (notifyIds.size > 0) {
      const notifications = Array.from(notifyIds).map(uid => ({
        user_id: uid,
        title: `Event date changed: ${event.name}`,
        body: `New date: ${new Date(event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}${reason ? ` — ${reason}` : ''}`,
        link: `/dashboard/events/${id}`,
      }))
      await supabase.from('notifications').insert(notifications)
    }
  }

  // Notify new POC on POC replacement
  if (poc_id) {
    await supabase.from('notifications').insert({
      user_id: poc_id,
      title: `You are now POC for: ${event.name}`,
      body: reason || 'You have been assigned as Point of Contact for this event.',
      link: `/dashboard/events/${id}`,
    })
  }

  return NextResponse.json({ ok: true, event })
}
