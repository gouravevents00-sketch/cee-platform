import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// ── POST /api/quotations/[id]/lock ────────────────────────────────
// Director-only. Locks quotation and triggers full auto-generation:
//   1. Elements (with vendor_id pre-set from quotation rows)
//   2. Payment milestones → payments table (client side)
//   3. Vendor SOs → vendor_purchase_orders (grouped by vendor_id)
//   4. Event status → active
//   5. Team tasks auto-generate
//   6. Client invoice draft
//   7. Notifications to team

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
    .from('quotations').select('*').eq('id', id).single()

  if (qErr || !quot) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
  if (quot.locked_at) return NextResponse.json({ error: 'Already locked' }, { status: 400 })

  const eventId = quot.event_id
  const rows: any[] = quot.items || []
  const milestones: any[] = quot.payment_milestones || []
  const grandTotal = quot.total || 0

  // ── 1. Lock the quotation ──────────────────────────────────────
  await supabase.from('quotations').update({
    locked_at: new Date().toISOString(),
    locked_by: user.id,
    status: 'accepted',
  }).eq('id', id)

  // ── 2. Generate elements from quotation rows ──────────────────
  const itemRows = rows.filter((r: any) => r._type === 'item' && r.description?.trim())
  let insertedElements: any[] = []
  if (itemRows.length > 0) {
    const elementsToInsert = itemRows.map((r: any) => ({
      event_id: eventId,
      name: r.description || '',
      specs: r.specs || null,
      size: r.dim_str || null,
      quantity: r.qty || 1,
      vendor_id: r.vendor_id || null,
      vendor_rate: r.is_lumpsum ? null : (r.vendor_rate || null),
      client_rate: r.is_lumpsum ? null : (r.rate || null),
      notes: r.is_lumpsum
        ? `Lumpsum: ₹${(r.lump_amount || 0).toLocaleString('en-IN')}`
        : null,
      status: 'pending',
    }))
    const { data: els } = await supabase.from('elements').insert(elementsToInsert).select()
    insertedElements = els || []
  }

  // ── 3. Generate payment milestones → payments table ───────────
  if (milestones.length > 0 && grandTotal > 0) {
    const paymentsToInsert = milestones
      .filter((m: any) => m.percent > 0)
      .map((m: any) => ({
        event_id: eventId,
        type: 'milestone' as const,
        label: m.label || 'Payment Milestone',
        amount: Math.round(grandTotal * (m.percent || 0) / 100),
        due_date: m.due_date || null,
        status: 'pending',
        notes: `Auto from quotation ${quot.quote_number || id} — ${m.percent}%`,
      }))
    try {
      await supabase.from('payments').insert(paymentsToInsert)
    } catch { /* schema may differ — non-blocking */ }
  }

  // ── 4. Generate Vendor SOs (grouped by vendor_id) ─────────────
  // Collect elements by vendor
  const vendorMap = new Map<string, { items: any[]; subtotal: number }>()
  itemRows.forEach((r: any) => {
    if (!r.vendor_id) return
    const existing = vendorMap.get(r.vendor_id) || { items: [], subtotal: 0 }
    const area = r.area_sqft || 0
    const mult = area > 0 ? area : 1
    const cost = r.is_lumpsum
      ? (r.lump_amount || 0)
      : (r.days || 1) * (r.qty || 1) * mult * (r.vendor_rate || 0)
    existing.items.push({
      name: r.description || '',
      specs: r.specs || '',
      size: r.dim_str || '',
      qty: r.qty || 1,
      days: r.days || 1,
      vendor_rate: r.vendor_rate || 0,
      is_lumpsum: r.is_lumpsum || false,
      lump_amount: r.lump_amount || 0,
      cost,
    })
    existing.subtotal += cost
    vendorMap.set(r.vendor_id, existing)
  })

  if (vendorMap.size > 0) {
    // Get event name for PO numbers
    const { data: ev } = await supabase.from('events').select('name').eq('id', eventId).single()
    const evCode = (ev?.name || 'EVENT').replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase()
    const soPrefix = quot.quote_number?.replace(/\//g, '-') || evCode

    const soInserts = Array.from(vendorMap.entries()).map(([vendorId, data], idx) => ({
      event_id: eventId,
      vendor_id: vendorId,
      quotation_id: id,
      po_number: `SO-${soPrefix}-${String(idx + 1).padStart(2, '0')}`,
      items: data.items,
      subtotal: data.subtotal,
      status: 'draft',
      notes: `Auto-generated from quotation ${quot.quote_number || id}`,
    }))

    try {
      await supabase.from('vendor_purchase_orders').insert(soInserts)
    } catch { /* table may not exist yet — non-blocking */ }
  }

  // ── 5. Set event status to active ────────────────────────────
  await supabase.from('events').update({ status: 'active' }).eq('id', eventId)

  // ── 6. Auto-generate team tasks if none exist ─────────────────
  const { count: taskCount } = await supabase
    .from('event_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)

  if ((taskCount || 0) === 0) {
    try {
      // Try new function name first, fallback to old name
      const { error: rpcErr } = await supabase.rpc('generate_event_tasks', { p_event_id: eventId })
      if (rpcErr) {
        await supabase.rpc('create_event_tasks', { p_event_id: eventId })
      }
    } catch { /* non-blocking */ }
  }

  // ── 7. Notify team ────────────────────────────────────────────
  const { data: event } = await supabase
    .from('events').select('name, poc_id').eq('id', eventId).single()

  const { data: teamMembers } = await supabase
    .from('event_team').select('user_id').eq('event_id', eventId).not('user_id', 'is', null)

  const notifyIds = new Set<string>()
  if (event?.poc_id) notifyIds.add(event.poc_id)
  teamMembers?.forEach((m: any) => { if (m.user_id) notifyIds.add(m.user_id) })

  if (notifyIds.size > 0) {
    const notifications = Array.from(notifyIds).map(uid => ({
      user_id: uid,
      title: 'Quotation Locked — Event Active',
      body: `${event?.name || 'Event'} quotation locked. Work begins now. Check elements + tasks.`,
      link: `/dashboard/events/${eventId}`,
    }))
    await supabase.from('notifications').insert(notifications)
  }

  // ── 8. Create client invoice draft ────────────────────────────
  try {
    const invoiceItems = itemRows.map((r: any) => {
      const area = r.area_sqft || 0
      const mult = area > 0 ? area : 1
      return {
        description: r.description,
        specs: r.specs || '',
        qty: r.qty || 1,
        days: r.days || 1,
        rate: r.rate || 0,
        amount: r.is_lumpsum
          ? (r.lump_amount || 0)
          : (r.days || 1) * (r.qty || 1) * mult * (r.rate || 0),
      }
    })

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

  // ── 9. Log activity ───────────────────────────────────────────
  try {
    await supabase.from('activity_log').insert({
      event_id: eventId,
      user_id: user.id,
      action: 'quotation_locked',
      detail: `Quotation ${quot.quote_number || id} locked. Total: ₹${grandTotal.toLocaleString('en-IN')}. ${itemRows.length} elements. ${vendorMap.size} vendor SOs.`,
    })
  } catch { /* non-blocking */ }

  return NextResponse.json({
    success: true,
    eventId,
    elementsCreated: insertedElements.length,
    vendorSOsCreated: vendorMap.size,
    milestonesCreated: milestones.filter((m: any) => m.percent > 0).length,
  })
}
