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
    return NextResponse.json({ error: 'Only director can delete vendors' }, { status: 403 })
  }

  // Block if assigned to active event elements
  const { data: activeElements } = await supabase
    .from('elements')
    .select('id, events!inner(id, name, status)')
    .eq('vendor_id', id)
    .not('events.status', 'in', '("completed","cancelled")')
    .limit(1) as any

  if (activeElements && activeElements.length > 0) {
    return NextResponse.json({
      error: `Cannot delete — this vendor is assigned to active event "${activeElements[0].events?.name}". Remove their assignments first.`
    }, { status: 409 })
  }

  const { error } = await supabase.from('vendors').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
