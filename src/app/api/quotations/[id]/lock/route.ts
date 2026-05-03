import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// ── POST /api/quotations/[id]/lock ────────────────────────────────
// Director-only. Locks quotation and triggers Phase 2 auto-generation:
//   • Elements (with vendor_id pre-set from quotation rows)
//   • Payment milestones → payments table
//   • Event status → active
//   • Team tasks auto-generate (if not already)
//   • Notifications to team

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'director') {
    return NextResponse.json({ error: 'Director only' }, { status: 403 })
  }

  // Fetch the quotation
  const { data: quot, error: qErr } = await supabase
    .from('quotations')
    .select('*')
    .eq('id', id)
    .single()

  if (qErr || !quot) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
  if (quot.locked_at) return NextResponse.json({ error: 'Already locked' }, { status: 400 })

  const eventId = quot.event_id
  const rows: any[] = quot.items || []
  const milestones: any[] = quot.payment_milestones || []

  // ── 1. Lock the quotation ──────────────────────────────────────
  await supabase.from('quotations').update({
    locked_at: new Date().toISOString(),
    locked_by: user.id,
    status: 'accepted',
  }).eq('id', id)

  // ── 2. Generate elements from quotation rows ──────────────────
  const elementRows = rows.filter((r: any) => r._type === 'item' && r.description?.trim())
  if (elementRows.length > 0) {
    const elementsToInsert = elementRows.map((r: any) => ({
      event_id: eventId,
      name: r.description || '',
      specs: r.specs || null,
      size: r.dim_str || null,
      quantity: r.qty || 1,
      vendor_id: r.vendor_id || null,
      vendor_rate: r.vendor_rate || null,
      client_rate: r.is_lumpsum ? null : (r.rate || null),
      notes: r.is_lumpsum ? `Lumpsum: ₹${r.lump_amount || 0}` : null,
      status: 'pending',
    }))
    await supabase.from('elements').insert(elementsToInsert)
  }

  // ── 3. Generate payment milestones → payments table ───────────
  if (milestones.length > 0) {
    const grandTotal = quot.total || 0
    const paymentsToInsert = milestones.map((m: any) => ({
      event_id: eventId,
      label: m.label || 'Payment Milestone',
      amount: m.amount || (grandTotal * (m.percent || 0) / 100),
      due_date: m.due_date || null,
      status: 'pending',
      notes: `Auto-generated from quotation ${quot.quote_number || id}`,
    }))
    // Only insert if payments table exists and has these columns
    // Using try/catch to not block lock if table schema differs
    try {
      await supabase.from('payments').insert(paymentsToInsert)
    } catch { /* payments table may have different structure */ }
  }

  // ── 4. Set event status to active ────────────────────────────
  await supabase.from('events').update({ status: 'active' }).eq('id', eventId)

  // ── 5. Auto-generate team tasks if none exist ─────────────────
  const { count: taskCount } = await supabase
    .from('event_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)

  if ((taskCount || 0) === 0) {
    // Call generate_event_tasks DB function if it exists
    try {
      await supabase.rpc('generate_event_tasks', { p_event_id: eventId })
    } catch { /* function may not exist yet */ }
  }

  // ── 6. Notify team ────────────────────────────────────────────
  const { data: event } = await supabase
    .from('events')
    .select('name, poc_id')
    .eq('id', eventId)
    .single()

  const { data: teamMembers } = await supabase
    .from('event_team')
    .select('user_id')
    .eq('event_id', eventId)
    .not('user_id', 'is', null)

  const notifyIds = new Set<string>()
  if (event?.poc_id) notifyIds.add(event.poc_id)
  teamMembers?.forEach((m: any) => { if (m.user_id) notifyIds.add(m.user_id) })

  if (notifyIds.size > 0) {
    const notifications = Array.from(notifyIds).map(uid => ({
      user_id: uid,
      title: 'Quotation Locked — Event Active',
      body: `${event?.name || 'Event'} quotation has been locked. Work begins now.`,
      link: `/dashboard/events/${eventId}`,
    }))
    await supabase.from('notifications').insert(notifications)
  }

  // ── 7. Create client invoice draft ────────────────────────────
  try {
    const invoiceItems = rows
      .filter((r: any) => r._type === 'item' && r.description?.trim())
      .map((r: any) => ({
        description: r.description,
        specs: r.specs || '',
        qty: r.qty || 1,
        days: r.days || 1,
        rate: r.rate || 0,
        amount: r.is_lumpsum ? (r.lump_amount || 0) : ((r.days || 1) * (r.qty || 1) * (r.rate || 0)),
      }))

    await supabase.from('client_invoices').insert({
      event_id: eventId,
      quotation_id: id,
      items: invoiceItems,
      subtotal: quot.subtotal || 0,
      gst_mode: quot.gst_mode || 'none',
      gst_amount: quot.gst_amount || 0,
      total: quot.total || 0,
      status: 'draft',
      notes: quot.notes || null,
      created_by: user.id,
    })
  } catch { /* non-blocking */ }

  // ── 8. Log activity ───────────────────────────────────────────
  try {
    await supabase.from('activity_log').insert({
      event_id: eventId,
      user_id: user.id,
      action: 'quotation_locked',
      details: `Quotation ${quot.quote_number || id} locked. Total: ₹${quot.total?.toLocaleString('en-IN') || 0}`,
    })
  } catch { /* non-blocking */ }

  return NextResponse.json({ success: true, eventId })
}
