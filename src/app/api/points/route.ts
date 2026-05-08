import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/points?period=monthly|alltime
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || 'monthly'

  let query = supabase
    .from('points_log')
    .select('user_id, points, created_at')

  if (period === 'monthly') {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    query = query.gte('created_at', start.toISOString())
  }

  const { data: logs, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate points per user
  const totals: Record<string, number> = {}
  for (const log of logs || []) {
    totals[log.user_id] = (totals[log.user_id] || 0) + log.points
  }

  if (!Object.keys(totals).length) {
    return NextResponse.json({ leaderboard: [], prizes: [] })
  }

  // Fetch profiles for users with points
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, role')
    .in('id', Object.keys(totals))

  // Fetch task counts per user (done tasks)
  const { data: taskCounts } = await supabase
    .from('event_tasks')
    .select('completed_by')
    .eq('status', 'done')
    .not('completed_by', 'is', null)

  const tasksByUser: Record<string, number> = {}
  for (const t of taskCounts || []) {
    if (t.completed_by) tasksByUser[t.completed_by] = (tasksByUser[t.completed_by] || 0) + 1
  }

  // Fetch badges per user
  const { data: badges } = await supabase
    .from('badges')
    .select('user_id, badge_key, awarded_at')
    .in('user_id', Object.keys(totals))

  const badgesByUser: Record<string, { key: string; awarded_at: string }[]> = {}
  for (const b of badges || []) {
    if (!badgesByUser[b.user_id]) badgesByUser[b.user_id] = []
    badgesByUser[b.user_id].push({ key: b.badge_key, awarded_at: b.awarded_at })
  }

  const leaderboard = (profiles || [])
    .filter(p => p.role !== 'director') // directors not in competition
    .map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      points: totals[p.id] || 0,
      tasks_done: tasksByUser[p.id] || 0,
      badges: badgesByUser[p.id] || [],
    }))
    .sort((a, b) => b.points - a.points)

  // Fetch prize config
  const { data: prizes } = await supabase
    .from('prize_config')
    .select('rank, label, description')
    .order('rank')

  return NextResponse.json({ leaderboard, prizes: prizes || [] })
}

// POST /api/points — award points
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const body = await req.json()
  const { target_user_id, points, reason, ref_type, ref_id, is_bonus } = body

  if (!target_user_id || !points || !reason) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Only directors can award manual bonus points
  if (is_bonus && profile.role !== 'director') {
    return NextResponse.json({ error: 'Only directors can award bonus points' }, { status: 403 })
  }

  const { error } = await supabase.from('points_log').insert({
    user_id: target_user_id,
    points,
    reason,
    ref_type: ref_type || null,
    ref_id: ref_id || null,
    awarded_by: user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Check and award badges
  await checkAndAwardBadges(supabase, target_user_id)

  return NextResponse.json({ success: true })
}

async function checkAndAwardBadges(supabase: any, userId: string) {
  const { data: existing } = await supabase
    .from('badges')
    .select('badge_key')
    .eq('user_id', userId)

  const hasBadge = (key: string) => existing?.some((b: any) => b.badge_key === key)

  // Count completed tasks by this user
  const { count: taskCount } = await supabase
    .from('event_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('completed_by', userId)
    .eq('status', 'done')

  const toAward: string[] = []

  if (taskCount && taskCount >= 1 && !hasBadge('first_task')) toAward.push('first_task')
  if (taskCount && taskCount >= 10 && !hasBadge('ten_tasks')) toAward.push('ten_tasks')
  if (taskCount && taskCount >= 25 && !hasBadge('twenty_five_tasks')) toAward.push('twenty_five_tasks')
  if (taskCount && taskCount >= 50 && !hasBadge('fifty_tasks')) toAward.push('fifty_tasks')

  // Check tasks done today
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count: todayCount } = await supabase
    .from('event_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('completed_by', userId)
    .eq('status', 'done')
    .gte('completed_at', todayStart.toISOString())

  if (todayCount && todayCount >= 5 && !hasBadge('daily_achiever')) toAward.push('daily_achiever')

  if (toAward.length) {
    await supabase.from('badges').insert(
      toAward.map(key => ({ user_id: userId, badge_key: key }))
    )
  }
}
