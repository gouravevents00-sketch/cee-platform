import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Runs at 9:15 AM IST (3:45 AM UTC) daily via Vercel Cron
// Checks events 1, 3, and 7 days out — flags risk conditions to POC + Directors

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

async function pushNotification(userId: string, title: string, body: string, link?: string) {
  await db.from('notifications').insert({ user_id: userId, title, body, link, read: false })
}

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// ─── Risk Checks ──────────────────────────────────────────────────────────────

async function checkEvent(event: {
  id: string
  name: string
  event_date: string
  current_phase: number
  poc_id: string | null
}, daysOut: number) {
  const risks: string[] = []

  // Pending tasks in current and prior phases
  const { count: pendingTasks } = await db
    .from('event_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event.id)
    .lte('phase', event.current_phase)
    .in('status', ['pending', 'in_progress'])

  if (pendingTasks && pendingTasks > 0) {
    risks.push(`${pendingTasks} task${pendingTasks > 1 ? 's' : ''} still pending in current phase`)
  }

  // Unpaid vendor advances
  if (daysOut <= 7) {
    const { count: unpaidVendors } = await db
      .from('vendor_payments')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .eq('status', 'pending')

    if (unpaidVendors && unpaidVendors > 0) {
      risks.push(`${unpaidVendors} vendor payment${unpaidVendors > 1 ? 's' : ''} not yet released`)
    }
  }

  // Artwork not approved (3 days or less)
  if (daysOut <= 3) {
    const { count: unapprovedArtwork } = await db
      .from('event_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .eq('phase', 5)
      .neq('status', 'done')

    if (unapprovedArtwork && unapprovedArtwork > 0) {
      risks.push(`${unapprovedArtwork} artwork task${unapprovedArtwork > 1 ? 's' : ''} not completed`)
    }
  }

  // No POC assigned
  if (!event.poc_id) {
    risks.push('No POC assigned to this event')
  }

  return risks
}

function alertTitle(daysOut: number, eventName: string): string {
  if (daysOut === 1) return `⚠️ Tomorrow: ${eventName}`
  if (daysOut === 3) return `⚡ 3 Days: ${eventName}`
  return `📋 7 Days: ${eventName}`
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get director IDs to always notify them
  const { data: directors } = await db
    .from('profiles')
    .select('id')
    .eq('role', 'director')

  const directorIds = directors?.map(d => d.id) ?? []

  let alertsSent = 0

  for (const daysOut of [1, 3, 7]) {
    const targetDate = daysFromNow(daysOut)

    const { data: events } = await db
      .from('events')
      .select('id, name, event_date, current_phase, poc_id')
      .eq('event_date', targetDate)
      .in('status', ['active', 'execution'])

    if (!events?.length) continue

    for (const event of events) {
      const risks = await checkEvent(event, daysOut)
      if (!risks.length) continue

      const title = alertTitle(daysOut, event.name)
      const body = risks.join(' · ')
      const link = `/dashboard/events/${event.id}`

      // Notify POC
      const notifyIds = new Set<string>(directorIds)
      if (event.poc_id) notifyIds.add(event.poc_id)

      await Promise.all(
        Array.from(notifyIds).map(uid => pushNotification(uid, title, body, link))
      )
      alertsSent++
    }
  }

  return NextResponse.json({ ok: true, alertsSent })
}
