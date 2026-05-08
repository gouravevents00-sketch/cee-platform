import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarDays, CheckSquare, AlertCircle, ChevronRight,
  Sparkles, Hammer, Clock, AlertTriangle, ArrowRight
} from 'lucide-react'
import { PHASES, STATUS_COLORS, ORDER_STATUS_COLORS, PRODUCTION_STATUS_COLORS, OrderStatus, ProductionStatus } from '@/lib/types'
import CopyBriefLink from '@/components/CopyBriefLink'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const isDirector = profile.role === 'director'
  const isAccounts = profile.role === 'accounts'
  const isAdmin = profile.role === 'admin'
  const canSeeFinancials = isDirector || isAccounts

  // ── Events ──────────────────────────────────────────────
  let eventsQuery = supabase
    .from('events')
    .select('*, clients(name), poc:profiles!events_poc_id_fkey(name)')
    .neq('status', 'completed')
    .neq('status', 'cancelled')
    .order('event_date', { ascending: true })
  if (profile.role === 'poc') eventsQuery = eventsQuery.eq('poc_id', user.id)
  const { data: events } = await eventsQuery.limit(6)

  // ── Experiences ──────────────────────────────────────────
  const { data: expOrders } = await supabase
    .from('experience_orders')
    .select('id, status, total_amount, event_name, event_date, service_type, client_name, items')
    .neq('status', 'cancelled')
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(4)

  const { data: expRevData } = await supabase
    .from('experience_orders')
    .select('total_amount')
    .neq('status', 'cancelled')
  const expRevenue = expRevData?.reduce((s, r) => s + (r.total_amount || 0), 0) || 0

  // ── Production ───────────────────────────────────────────
  const { data: prodProjects } = await supabase
    .from('production_orders')
    .select('id, status, quoted_amount, event_name, event_date, service_type, client_name')
    .neq('status', 'cancelled')
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(4)

  const { data: prodRevData } = await supabase
    .from('production_orders')
    .select('quoted_amount')
    .neq('status', 'cancelled')
  const prodPipeline = prodRevData?.reduce((s, r) => s + (r.quoted_amount || 0), 0) || 0

  // ── Inventory alerts ─────────────────────────────────────
  const { data: lowStock } = await supabase
    .from('inventory_items')
    .select('id, name, qty_available, unit')
    .eq('is_active', true)
    .eq('qty_available', 0)
    .limit(5)

  // ── Approvals + Expenses ─────────────────────────────────
  const { data: pendingApprovals } = isDirector
    ? await supabase.from('approvals').select('id, type, events(name)').eq('status', 'pending').order('requested_at', { ascending: false }).limit(4)
    : { data: [] }

  const { data: pendingExpenses } = canSeeFinancials
    ? await supabase.from('expenses').select('id, item, amount, events(name)').eq('status', 'pending').order('submitted_at', { ascending: false }).limit(4)
    : { data: [] }

  // ── Director: overdue vendor payments ────────────────────
  const { count: overdueVendorCount } = isDirector
    ? await supabase.from('vendor_payments').select('id', { count: 'exact', head: true }).eq('status', 'overdue')
    : { count: 0 }

  // ── Director: phase-ready events (all current-phase tasks done) ──
  const { data: allActiveTasks } = isDirector
    ? await supabase
        .from('event_tasks')
        .select('event_id, phase, status, events!inner(id, name, current_phase, event_date, status)')
        .not('events.status', 'in', '("completed","cancelled")')
    : { data: [] }

  const phaseReadyEvents: { id: string; name: string; current_phase: number }[] = []
  if (isDirector && allActiveTasks) {
    const byEvent: Record<string, { event: any; tasks: any[] }> = {}
    ;(allActiveTasks as any[]).forEach(t => {
      if (!byEvent[t.event_id]) byEvent[t.event_id] = { event: t.events, tasks: [] }
      byEvent[t.event_id].tasks.push(t)
    })
    Object.values(byEvent).forEach(({ event, tasks }) => {
      if (!event || event.current_phase >= 7) return
      const phaseTasks = tasks.filter(t => t.phase === event.current_phase)
      if (phaseTasks.length > 0 && phaseTasks.every(t => t.status === 'done')) {
        phaseReadyEvents.push(event)
      }
    })
  }

  const attentionCount = (pendingApprovals?.length || 0) + (pendingExpenses?.length || 0) + (overdueVendorCount || 0) + phaseReadyEvents.length

  // ── My Tasks (non-director/accounts) ─────────────────────
  const { data: myTasks } = (!isDirector && !isAccounts)
    ? await supabase
        .from('event_tasks')
        .select('id, task_name, status, phase_name, events(name)')
        .eq('owner_role', profile.role)
        .in('status', ['pending', 'in_progress'])
        .limit(5)
    : { data: [] }

  const firstName = profile.name.split(' ')[0]
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-white text-2xl font-bold">{greeting}, {firstName}</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Director quick actions */}
      {isDirector && (
        <div className="flex gap-2 flex-wrap">
          <CopyBriefLink />
          <Link
            href="/dashboard/events/new"
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white text-sm font-medium transition-all"
          >
            <CalendarDays size={15} /> New Event
          </Link>
        </div>
      )}

      {/* ── Director: Needs Your Attention ── */}
      {isDirector && attentionCount > 0 && (
        <div className="bg-amber-950/30 border border-amber-700/40 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber-400" />
            <p className="text-amber-300 font-semibold text-sm">{attentionCount} item{attentionCount > 1 ? 's' : ''} need your attention</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {phaseReadyEvents.length > 0 && (
              <Link href="/dashboard/events" className="bg-gray-900/80 border border-amber-700/30 rounded-xl p-3 hover:border-amber-500/50 transition-colors group">
                <p className="text-amber-400 text-xl font-bold">{phaseReadyEvents.length}</p>
                <p className="text-gray-400 text-xs mt-0.5">Phase{phaseReadyEvents.length > 1 ? 's' : ''} ready to advance</p>
                <div className="mt-1.5 space-y-0.5">
                  {phaseReadyEvents.slice(0, 2).map(e => (
                    <p key={e.id} className="text-gray-500 text-xs truncate">↗ {e.name}</p>
                  ))}
                  {phaseReadyEvents.length > 2 && <p className="text-gray-600 text-xs">+{phaseReadyEvents.length - 2} more</p>}
                </div>
              </Link>
            )}
            {(pendingApprovals?.length || 0) > 0 && (
              <Link href="/dashboard/approvals" className="bg-gray-900/80 border border-amber-700/30 rounded-xl p-3 hover:border-amber-500/50 transition-colors group flex items-start justify-between">
                <div>
                  <p className="text-amber-400 text-xl font-bold">{pendingApprovals!.length}</p>
                  <p className="text-gray-400 text-xs mt-0.5">Approval{pendingApprovals!.length > 1 ? 's' : ''} pending</p>
                </div>
                <ArrowRight size={14} className="text-gray-600 group-hover:text-amber-400 transition-colors mt-1" />
              </Link>
            )}
            {(pendingExpenses?.length || 0) > 0 && (
              <Link href="/dashboard/expenses" className="bg-gray-900/80 border border-amber-700/30 rounded-xl p-3 hover:border-amber-500/50 transition-colors group flex items-start justify-between">
                <div>
                  <p className="text-amber-400 text-xl font-bold">{pendingExpenses!.length}</p>
                  <p className="text-gray-400 text-xs mt-0.5">Expense{pendingExpenses!.length > 1 ? 's' : ''} to approve</p>
                </div>
                <ArrowRight size={14} className="text-gray-600 group-hover:text-amber-400 transition-colors mt-1" />
              </Link>
            )}
            {(overdueVendorCount || 0) > 0 && (
              <Link href="/dashboard/vendors" className="bg-gray-900/80 border border-red-700/30 rounded-xl p-3 hover:border-red-500/50 transition-colors group flex items-start justify-between">
                <div>
                  <p className="text-red-400 text-xl font-bold">{overdueVendorCount}</p>
                  <p className="text-gray-400 text-xs mt-0.5">Vendor payment{overdueVendorCount! > 1 ? 's' : ''} overdue</p>
                </div>
                <ArrowRight size={14} className="text-gray-600 group-hover:text-red-400 transition-colors mt-1" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Top Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/dashboard/events" className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays size={15} className="text-amber-500" />
            <span className="text-gray-400 text-xs">Active Events</span>
          </div>
          <p className="text-white text-3xl font-bold">{events?.length || 0}</p>
        </Link>

        <Link href="/dashboard/experiences/orders" className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={15} className="text-purple-400" />
            <span className="text-gray-400 text-xs">Exp. Orders</span>
          </div>
          <p className="text-white text-3xl font-bold">{expOrders?.length || 0}</p>
          {canSeeFinancials && expRevenue > 0 && (
            <p className="text-amber-400 text-xs mt-1">₹{expRevenue.toLocaleString('en-IN')}</p>
          )}
        </Link>

        <Link href="/dashboard/production/projects" className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Hammer size={15} className="text-orange-400" />
            <span className="text-gray-400 text-xs">Production</span>
          </div>
          <p className="text-white text-3xl font-bold">{prodProjects?.length || 0}</p>
          {canSeeFinancials && prodPipeline > 0 && (
            <p className="text-amber-400 text-xs mt-1">₹{prodPipeline.toLocaleString('en-IN')} pipeline</p>
          )}
        </Link>

        {isDirector && (
          <Link href="/dashboard/approvals" className="bg-gray-900 border border-amber-900/30 hover:border-amber-700/50 rounded-2xl p-4 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <CheckSquare size={15} className="text-amber-400" />
              <span className="text-gray-400 text-xs">Approvals</span>
            </div>
            <p className="text-white text-3xl font-bold">{pendingApprovals?.length || 0}</p>
            {(pendingApprovals?.length || 0) > 0 && (
              <p className="text-amber-400 text-xs mt-1">needs attention</p>
            )}
          </Link>
        )}

        {!isDirector && !isAccounts && (
          <Link href="/dashboard/my-tasks" className="bg-gray-900 border border-blue-900/30 hover:border-blue-700/50 rounded-2xl p-4 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={15} className="text-blue-400" />
              <span className="text-gray-400 text-xs">My Tasks</span>
            </div>
            <p className="text-white text-3xl font-bold">{myTasks?.length || 0}</p>
            {(myTasks?.length || 0) > 0 && (
              <p className="text-blue-400 text-xs mt-1">tap to view all</p>
            )}
          </Link>
        )}
        {isAccounts && (
          <Link href="/dashboard/expenses" className="bg-gray-900 border border-green-900/30 hover:border-green-700/50 rounded-2xl p-4 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={15} className="text-green-400" />
              <span className="text-gray-400 text-xs">Pending Expenses</span>
            </div>
            <p className="text-white text-3xl font-bold">{pendingExpenses?.length || 0}</p>
            {(pendingExpenses?.length || 0) > 0 && (
              <p className="text-green-400 text-xs mt-1">needs review</p>
            )}
          </Link>
        )}
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Active Events */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold">Active Events</h2>
            <Link href="/dashboard/events" className="text-amber-500 text-xs hover:text-amber-400 flex items-center gap-1">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {events && events.length > 0 ? events.map((event: any) => (
              <Link key={event.id} href={`/dashboard/events/${event.id}`}
                className="block bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{event.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {event.clients?.name && <span className="text-gray-500 text-xs">{event.clients.name}</span>}
                      {event.event_date && (
                        <span className="text-gray-600 text-xs flex items-center gap-1">
                          <CalendarDays size={10} />
                          {new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[event.status as keyof typeof STATUS_COLORS]}`}>
                      {event.status}
                    </span>
                    <span className="text-gray-600 text-xs">{PHASES[event.current_phase]?.name}</span>
                  </div>
                </div>
              </Link>
            )) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <p className="text-gray-500 text-sm">No active events</p>
                {isDirector && (
                  <Link href="/dashboard/events/new" className="text-amber-500 text-sm mt-2 inline-block hover:text-amber-400">+ New Event</Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Pending Approvals */}
          {isDirector && (pendingApprovals?.length || 0) > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-white font-semibold text-sm">Approvals</h2>
                <Link href="/dashboard/approvals" className="text-amber-500 text-xs hover:text-amber-400">View all</Link>
              </div>
              <div className="space-y-1.5">
                {pendingApprovals!.slice(0, 3).map((a: any) => (
                  <Link key={a.id} href="/dashboard/approvals"
                    className="block bg-gray-900 border border-amber-900/30 rounded-xl p-3 hover:border-amber-700/50 transition-colors">
                    <p className="text-white text-xs font-medium">{a.type}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{a.events?.name}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* My Tasks */}
          {!isDirector && !isAccounts && (myTasks?.length || 0) > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-white font-semibold text-sm">My Tasks</h2>
                <Link href="/dashboard/my-tasks" className="text-amber-500 text-xs hover:text-amber-400">View all</Link>
              </div>
              <div className="space-y-1.5">
                {myTasks!.map((t: any) => (
                  <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                    <p className="text-white text-xs font-medium">{t.task_name}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-gray-500 text-xs">{t.events?.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${t.status === 'in_progress' ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-800 text-gray-500'}`}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expenses */}
          {canSeeFinancials && (pendingExpenses?.length || 0) > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-white font-semibold text-sm">Expenses Pending</h2>
                <Link href="/dashboard/expenses" className="text-amber-500 text-xs hover:text-amber-400">View all</Link>
              </div>
              <div className="space-y-1.5">
                {pendingExpenses!.slice(0, 3).map((e: any) => (
                  <div key={e.id} className="bg-gray-900 border border-orange-900/30 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-white text-xs font-medium truncate flex-1">{e.item}</p>
                      <p className="text-amber-400 text-xs font-semibold ml-2">₹{e.amount.toLocaleString('en-IN')}</p>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">{e.events?.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inventory Alert */}
          {(isDirector || isAdmin) && (lowStock?.length || 0) > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="text-red-400" />
                  <h2 className="text-white font-semibold text-sm">Out of Stock</h2>
                </div>
                <Link href="/dashboard/inventory" className="text-amber-500 text-xs hover:text-amber-400">View all</Link>
              </div>
              <div className="space-y-1.5">
                {lowStock!.map((item: any) => (
                  <Link key={item.id} href={`/dashboard/inventory/${item.id}`}
                    className="block bg-gray-900 border border-red-900/30 rounded-xl p-3 hover:border-red-700/40 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="text-white text-xs font-medium">{item.name}</p>
                      <span className="text-red-400 text-xs font-semibold">0 {item.unit}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Experiences + Production row ── */}
      {(isDirector || isAdmin || isAccounts) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Experience Orders */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-purple-400" />
                <h2 className="text-white font-semibold">Experience Orders</h2>
              </div>
              <Link href="/dashboard/experiences/orders" className="text-amber-500 text-xs hover:text-amber-400 flex items-center gap-1">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            <div className="space-y-2">
              {expOrders && expOrders.length > 0 ? expOrders.map((o: any) => (
                <Link key={o.id} href={`/dashboard/experiences/orders/${o.id}`}
                  className="block bg-gray-900 border border-gray-800 rounded-xl p-3 hover:border-gray-700 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{o.event_name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{o.client_name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS_COLORS[o.status as OrderStatus]}`}>
                        {o.status}
                      </span>
                      {canSeeFinancials && (
                        <p className="text-amber-400 text-xs font-semibold mt-0.5">₹{o.total_amount.toLocaleString('en-IN')}</p>
                      )}
                    </div>
                  </div>
                </Link>
              )) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
                  <p className="text-gray-500 text-xs">No active experience orders</p>
                  <Link href="/dashboard/experiences/new" className="text-amber-500 text-xs mt-1 inline-block hover:text-amber-400">+ New Booking</Link>
                </div>
              )}
            </div>
          </div>

          {/* Production Projects */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Hammer size={15} className="text-orange-400" />
                <h2 className="text-white font-semibold">Production Projects</h2>
              </div>
              <Link href="/dashboard/production/projects" className="text-amber-500 text-xs hover:text-amber-400 flex items-center gap-1">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            <div className="space-y-2">
              {prodProjects && prodProjects.length > 0 ? prodProjects.map((p: any) => (
                <Link key={p.id} href={`/dashboard/production/projects/${p.id}`}
                  className="block bg-gray-900 border border-gray-800 rounded-xl p-3 hover:border-gray-700 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{p.event_name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{p.client_name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRODUCTION_STATUS_COLORS[p.status as ProductionStatus]}`}>
                        {p.status.replace('_', ' ')}
                      </span>
                      {canSeeFinancials && p.quoted_amount && (
                        <p className="text-amber-400 text-xs font-semibold mt-0.5">₹{p.quoted_amount.toLocaleString('en-IN')}</p>
                      )}
                      {!p.quoted_amount && (
                        <p className="text-gray-600 text-xs mt-0.5">Quote pending</p>
                      )}
                    </div>
                  </div>
                </Link>
              )) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
                  <p className="text-gray-500 text-xs">No active production projects</p>
                  <Link href="/dashboard/production/new" className="text-amber-500 text-xs mt-1 inline-block hover:text-amber-400">+ New Brief</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
