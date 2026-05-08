import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Runs at 9:00 AM IST (3:30 AM UTC) daily via Vercel Cron
// Generates a role-specific morning briefing notification for every active team member

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // local dev — skip check
  return req.headers.get('authorization') === `Bearer ${secret}`
}

async function callClaude(prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  return data.content?.[0]?.text?.trim() || ''
}

async function pushNotification(userId: string, title: string, body: string, link?: string) {
  await db.from('notifications').insert({ user_id: userId, title, body, link, read: false })
}

const today = () => new Date().toLocaleDateString('en-IN', {
  weekday: 'long', day: 'numeric', month: 'long',
})

// ─── Role Handlers ────────────────────────────────────────────────────────────

async function briefDirector(userId: string, name: string) {
  const [{ data: events }, { data: approvals }, { data: overduePayments }] = await Promise.all([
    db.from('events')
      .select('id, name, event_date, current_phase, city, status')
      .in('status', ['active', 'execution'])
      .order('event_date', { ascending: true })
      .limit(5),
    db.from('approvals').select('id').eq('status', 'pending'),
    db.from('payments').select('id, amount').eq('status', 'overdue'),
  ])

  if (!events?.length && !approvals?.length && !overduePayments?.length) return

  const prompt = `You are writing a morning briefing notification for ${name}, Director at Creative Era Events.
Today is ${today()}.

Data:
- Active/Execution events: ${JSON.stringify(events?.map(e => ({ name: e.name, date: e.event_date, phase: e.current_phase, city: e.city, status: e.status })))}
- Pending approvals: ${approvals?.length ?? 0}
- Overdue client payments: ${overduePayments?.length ?? 0} (total ₹${overduePayments?.reduce((s, p) => s + p.amount, 0).toLocaleString('en-IN') ?? 0})

Write a 2-line morning briefing. Lead with the most urgent thing. Professional English. No greetings. No bullet points. Plain text only.`

  const body = await callClaude(prompt)
  if (body) {
    await pushNotification(userId, `Good morning, ${name.split(' ')[0]}`, body, '/dashboard')
  }
}

async function briefPOC(userId: string, name: string) {
  const { data: events } = await db
    .from('events')
    .select('id, name, event_date, current_phase, city')
    .eq('poc_id', userId)
    .in('status', ['active', 'execution'])
    .order('event_date', { ascending: true })
    .limit(3)

  if (!events?.length) return

  // Get pending task counts per event
  const taskCounts = await Promise.all(
    events.map(async e => {
      const { count } = await db
        .from('event_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', e.id)
        .in('status', ['pending', 'in_progress'])
      return { ...e, pending_tasks: count ?? 0 }
    })
  )

  const prompt = `You are writing a morning briefing notification for ${name}, an on-ground POC at Creative Era Events.
Today is ${today()}.

Their assigned events: ${JSON.stringify(taskCounts.map(e => ({
    name: e.name,
    date: e.event_date,
    phase: e.current_phase,
    city: e.city,
    pending_tasks: e.pending_tasks,
  })))}

Write a 2-line morning briefing telling them what needs attention today. Mention the nearest event and task count. Professional but direct. No greetings. Plain text only.`

  const body = await callClaude(prompt)
  if (body) {
    const link = events.length === 1 ? `/dashboard/events/${events[0].id}` : '/dashboard'
    await pushNotification(userId, `Good morning, ${name.split(' ')[0]}`, body, link)
  }
}

async function briefDesign(userId: string, name: string) {
  const { data: tasks } = await db
    .from('event_tasks')
    .select('task_name, events(name, event_date)')
    .eq('owner_role', 'design')
    .in('status', ['pending', 'in_progress'])
    .limit(5)

  if (!tasks?.length) return

  const prompt = `You are writing a morning briefing for ${name}, Design Lead at Creative Era Events.
Today is ${today()}.

Pending design tasks: ${JSON.stringify(tasks.map((t: any) => ({
    task: t.task_name,
    event: t.events?.name,
    date: t.events?.event_date,
  })))}

Write 1-2 lines. Mention task count and nearest deadline. Professional English. No greetings. Plain text only.`

  const body = await callClaude(prompt)
  if (body) {
    await pushNotification(userId, `Good morning, ${name.split(' ')[0]}`, body, '/dashboard/my-tasks')
  }
}

async function briefAdmin(userId: string, name: string) {
  const { data: tasks } = await db
    .from('event_tasks')
    .select('task_name, events(name, event_date)')
    .eq('owner_role', 'admin')
    .in('status', ['pending', 'in_progress'])
    .limit(5)

  if (!tasks?.length) return

  const prompt = `You are writing a morning briefing for ${name}, Admin/Logistics at Creative Era Events.
Today is ${today()}.

Pending admin tasks: ${JSON.stringify(tasks.map((t: any) => ({
    task: t.task_name,
    event: t.events?.name,
    date: t.events?.event_date,
  })))}

Write 1-2 lines. Direct and actionable. Professional English. No greetings. Plain text only.`

  const body = await callClaude(prompt)
  if (body) {
    await pushNotification(userId, `Good morning, ${name.split(' ')[0]}`, body, '/dashboard/my-tasks')
  }
}

async function briefAccounts(userId: string, name: string) {
  const [{ count: expenseCount }, { data: overduePayments }] = await Promise.all([
    db.from('expenses').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('payments').select('amount').eq('status', 'overdue'),
  ])

  if (!expenseCount && !overduePayments?.length) return

  const totalOverdue = overduePayments?.reduce((s, p) => s + p.amount, 0) ?? 0

  const prompt = `You are writing a morning briefing for ${name}, Accounts at Creative Era Events.
Today is ${today()}.

- Pending expense approvals: ${expenseCount ?? 0}
- Overdue client payments: ${overduePayments?.length ?? 0} (total ₹${totalOverdue.toLocaleString('en-IN')})

Write 1-2 lines. Lead with most urgent item. Professional English. No greetings. Plain text only.`

  const body = await callClaude(prompt)
  if (body) {
    await pushNotification(userId, `Good morning, ${name.split(' ')[0]}`, body, '/dashboard/followup')
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: users } = await db
    .from('profiles')
    .select('id, name, role')

  if (!users?.length) return NextResponse.json({ ok: true, sent: 0 })

  const results = await Promise.allSettled(
    users.map(async u => {
      if (u.role === 'director') return briefDirector(u.id, u.name)
      if (u.role === 'poc') return briefPOC(u.id, u.name)
      if (u.role === 'design') return briefDesign(u.id, u.name)
      if (u.role === 'admin') return briefAdmin(u.id, u.name)
      if (u.role === 'accounts') return briefAccounts(u.id, u.name)
    })
  )

  const failed = results.filter(r => r.status === 'rejected').length
  return NextResponse.json({ ok: true, processed: users.length, failed })
}
