import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'director') {
    return NextResponse.json({ error: 'Only director can delete clients' }, { status: 403 })
  }

  // Block if active events exist
  const { data: activeEvents } = await supabase
    .from('events')
    .select('id, name')
    .eq('client_id', id)
    .not('status', 'in', '("completed","cancelled")')
    .limit(1)

  if (activeEvents && activeEvents.length > 0) {
    return NextResponse.json({
      error: `Cannot delete — "${activeEvents[0].name}" is still active. Complete or cancel all events first.`
    }, { status: 409 })
  }

  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
