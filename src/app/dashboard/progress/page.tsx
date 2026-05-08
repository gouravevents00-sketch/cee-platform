import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const STATUS_COLOR: Record<string, string> = {
  done:        'bg-green-900/40 text-green-400 border-green-800/40',
  in_progress: 'bg-amber-900/40 text-amber-400 border-amber-800/40',
  pending:     'bg-gray-800 text-gray-400 border-gray-700',
  blocked:     'bg-red-900/40 text-red-400 border-red-800/40',
}

const ROLE_LABEL: Record<string, string> = {
  poc: 'POC', admin: 'Admin', design: 'Design', accounts: 'Accounts', director: 'Director',
}

export default async function ProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'director') redirect('/dashboard')

  const { data: events } = await supabase
    .from('events')
    .select('id, name, city, event_date, status, current_phase')
    .not('status', 'in', '("completed","cancelled")')
    .order('event_date', { ascending: true })

  if (!events?.length) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-white text-xl font-bold mb-6">Team Progress</h1>
        <p className="text-gray-500 text-sm">No active events.</p>
      </div>
    )
  }

  // Fetch all tasks with completer profile
  const { data: allTasks } = await supabase
    .from('event_tasks')
    .select('id, event_id, phase_name, task_name, task_type, owner_role, status, notes, completed_at, completer:profiles!event_tasks_completed_by_fkey(name)')
    .in('event_id', events.map(e => e.id))
    .order('phase')

  const tasksByEvent = (allTasks || []).reduce((acc, t) => {
    if (!acc[t.event_id]) acc[t.event_id] = []
    acc[t.event_id].push(t)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-white text-xl font-bold">Team Progress</h1>
        <p className="text-gray-500 text-sm mt-0.5">All tasks across active events — who did what, what's still pending.</p>
      </div>

      {events.map(event => {
        const tasks = tasksByEvent[event.id] || []
        const done = tasks.filter((t: any) => t.status === 'done').length
        const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0
        const pending = tasks.filter((t: any) => t.status === 'pending')
        const inProgress = tasks.filter((t: any) => t.status === 'in_progress')
        const doneTasks = tasks.filter((t: any) => t.status === 'done')

        return (
          <div key={event.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {/* Event header */}
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white font-semibold">{event.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {event.city} · {new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white text-2xl font-bold">{pct}%</p>
                  <p className="text-gray-500 text-xs">{done}/{tasks.length} tasks done</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              {/* Quick stats */}
              <div className="flex gap-3 mt-3 flex-wrap">
                {inProgress.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400 border border-amber-800/40">
                    {inProgress.length} in progress
                  </span>
                )}
                {pending.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                    {pending.length} pending
                  </span>
                )}
                {done > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/40">
                    {done} done
                  </span>
                )}
              </div>
            </div>

            {/* Pending / In Progress tasks — needs attention */}
            {(pending.length > 0 || inProgress.length > 0) && (
              <div className="p-4 border-b border-gray-800">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Needs Attention</p>
                <div className="space-y-1.5">
                  {[...inProgress, ...pending].map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2.5 text-xs">
                      <span className={`px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLOR[t.status]}`}>
                        {t.status === 'in_progress' ? 'In Progress' : 'Pending'}
                      </span>
                      <span className="text-gray-300 flex-1 truncate">{t.task_name}</span>
                      <span className="text-gray-600 flex-shrink-0">{ROLE_LABEL[t.owner_role] || t.owner_role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed tasks — proof trail */}
            {doneTasks.length > 0 && (
              <div className="p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Completed</p>
                <div className="space-y-2">
                  {doneTasks.map((t: any) => (
                    <div key={t.id} className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-green-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-400 text-xs leading-snug">{t.task_name}</p>
                        {t.notes && (
                          <p className="text-gray-600 text-xs mt-0.5 italic">"{t.notes}"</p>
                        )}
                        <p className="text-gray-700 text-xs mt-0.5">
                          {t.completer?.name || ROLE_LABEL[t.owner_role] || t.owner_role}
                          {t.completed_at && ` · ${relativeTime(t.completed_at)}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
