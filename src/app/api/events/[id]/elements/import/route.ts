import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { rows } = await req.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  const toInsert = rows.map((row: any) => ({
    event_id: eventId,
    name: String(row.name || '').trim(),
    specs: row.specs ? String(row.specs).trim() : null,
    quantity: parseInt(row.quantity || row.qty || '1') || 1,
    size: row.size ? String(row.size).trim() : null,
    material: row.material ? String(row.material).trim() : null,
    vendor_rate: row.vendor_rate ? parseFloat(row.vendor_rate) : null,
    client_rate: row.client_rate ? parseFloat(row.client_rate) : null,
    poc_owner: row.poc_owner ? String(row.poc_owner).trim() : null,
    notes: row.notes ? String(row.notes).trim() : null,
    status: 'pending',
  })).filter(r => r.name.length > 0)

  const { error } = await supabase.from('elements').insert(toInsert)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.from('activity_log').insert({
    event_id: eventId,
    user_id: user.id,
    action: 'Elements Imported',
    detail: `${toInsert.length} elements imported via CSV`,
  })

  return NextResponse.json({ ok: true, count: toInsert.length })
}
