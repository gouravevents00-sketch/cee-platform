'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Circle, Clock, CalendarDays, ChevronRight, AlertTriangle } from 'lucide-react'
import { PHASES } from '@/lib/types'

interface Task {
  id: string
  task_name: string
  task_number: string
  task_type: 'action' | 'approval' | 'followup'
  phase: number
  phase_name: string
  status: 'pending' | 'in_progress' | 'done' | 'blocked'
  notes?: string
  completed_at?: string
  events: {
    id: string
    name: string
    event_date?: string
    status: string
    current_phase: number
    clients?: { name: string }
  }
}

interface Props {
  tasks: Task[]
  userId: string
  userRole: string
}

const TASK_TYPE_COLORS = {
  action: 'bg-blue-900/30 text-blue-400',
  approval: 'bg-amber-900/30 text-amber-400',
  followup: 'bg-green-900/30 text-green-400',
}

const STATUS_STYLE = {
  pending: { icon: <Circle size={15} className="text-gray-500" />, text: 'text-gray-400' },
  in_progress: { icon: <Clock size={15} className="text-blue-400" />, text: 'text-blue-300' },
  done: { icon: <CheckCircle2 size={15} className="text-green-400" />, text: 'text-green-400 line-through' },
  blocked: { icon: <AlertTriangle size={15} className="text-red-400" />, text: 'text-red-300' },
}

function daysUntil(dateStr?: string) {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  return diff
}

export default function MyTasksView({ tasks, userId, userRole }: Props) {
  const [updating, setUpdating] = useState<string | null>(null)
  const [filter, setFilter] = useState<'active' | 'done' | 'all'>('active')
  const [phaseFilter, setPhaseFilter] = useState<'current' | 'all'>(userRole === 'admin' ? 'current' : 'all')
  const router = useRouter()
  const supabase = createClient()

  async function setStatus(taskId: string, status: Task['status']) {
    setUpdating(taskId)
    await supabase.from('event_tasks').update({
      status,
      completed_by: status === 'done' ? userId : null,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    }).eq('id', taskId)
    router.refresh()
    setUpdating(null)
  }

  const filtered = tasks.filter(t => {
    const statusMatch = filter === 'active' ? t.status !== 'done' :
      filter === 'done' ? t.status === 'done' : true
    const phaseMatch = phaseFilter === 'current' ? t.phase === t.events.current_phase : true
    return statusMatch && phaseMatch
  })

  // Group by event
  const byEvent: Record<string, { event: Task['events']; tasks: Task[] }> = {}
  filtered.forEach(t => {
    if (!byEvent[t.events.id]) byEvent[t.events.id] = { event: t.events, tasks: [] }
    byEvent[t.events.id].tasks.push(t)
  })

  const eventGroups = Object.values(byEvent)
    .sort((a, b) => {
      // Sort: events with upcoming dates first
      const da = new Date(a.event.event_date || '9999').getTime()
      const db = new Date(b.event.event_date || '9999').getTime()
      return da - db
    })

  const pendingCount = tasks.filter(t => t.status !== 'done').length
  const doneCount = tasks.filter(t => t.status === 'done').length
  const inCurrentPhase = tasks.filter(t => t.status !== 'done' && t.phase === t.events.current_phase).length

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
          <p className="text-amber-400 text-2xl font-bold">{pendingCount}</p>
          <p className="text-gray-500 text-xs mt-0.5">Pending</p>
        </div>
        <div className="bg-gray-900 border border-blue-900/30 rounded-2xl p-4 text-center">
          <p className="text-blue-400 text-2xl font-bold">{inCurrentPhase}</p>
          <p className="text-gray-500 text-xs mt-0.5">In Active Phase</p>
        </div>
        <div className="bg-gray-900 border border-green-900/30 rounded-2xl p-4 text-center">
          <p className="text-green-400 text-2xl font-bold">{doneCount}</p>
          <p className="text-gray-500 text-xs mt-0.5">Done</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(['active', 'all', 'done'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-amber-500 text-black' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'}`}>
            {f === 'active' ? 'Active' : f === 'done' ? 'Completed' : 'All Tasks'}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button onClick={() => setPhaseFilter('current')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${phaseFilter === 'current' ? 'bg-blue-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'}`}>
            Current Phase
          </button>
          <button onClick={() => setPhaseFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${phaseFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'}`}>
            All Phases
          </button>
        </div>
      </div>

      {eventGroups.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
          <CheckCircle2 size={32} className="text-green-500 mx-auto mb-3" />
          <p className="text-white font-semibold">All caught up!</p>
          <p className="text-gray-500 text-sm mt-1">No {filter === 'active' ? 'pending' : ''} tasks right now</p>
        </div>
      ) : (
        <div className="space-y-4">
          {eventGroups.map(({ event, tasks: eventTasks }) => {
            const days = daysUntil(event.event_date)
            const currentPhase = PHASES[event.current_phase]
            const myPhaseTask = eventTasks.some(t => t.phase === event.current_phase && t.status !== 'done')

            return (
              <div key={event.id} className={`bg-gray-900 border rounded-2xl overflow-hidden ${myPhaseTask ? 'border-amber-700/40' : 'border-gray-800'}`}>
                {/* Event header */}
                <div className={`px-5 py-3.5 border-b border-gray-800 flex items-center justify-between gap-3 ${myPhaseTask ? 'bg-amber-950/20' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {myPhaseTask && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
                      <Link href={`/dashboard/events/${event.id}`} className="text-white font-semibold hover:text-amber-400 transition-colors truncate">
                        {event.name}
                      </Link>
                      {event.clients?.name && <span className="text-gray-500 text-xs">{event.clients.name}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {event.event_date && (
                        <span className={`flex items-center gap-1 text-xs ${days !== null && days <= 7 && days >= 0 ? 'text-orange-400 font-medium' : 'text-gray-500'}`}>
                          <CalendarDays size={10} />
                          {days === 0 ? 'Today!' : days !== null && days < 0 ? 'Past' : days !== null ? `in ${days}d` : ''}
                          {' '}
                          {new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      {currentPhase && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${currentPhase.color}`}>
                          Phase {event.current_phase}: {currentPhase.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link href={`/dashboard/events/${event.id}`} className="text-gray-600 hover:text-gray-400 flex-shrink-0">
                    <ChevronRight size={16} />
                  </Link>
                </div>

                {/* Tasks list */}
                <div className="divide-y divide-gray-800">
                  {eventTasks.map(task => {
                    const s = STATUS_STYLE[task.status]
                    const isCurrentPhase = task.phase === event.current_phase

                    return (
                      <div key={task.id} className={`flex items-center gap-3 px-5 py-3.5 ${task.status === 'done' ? 'opacity-50' : ''} ${isCurrentPhase && task.status !== 'done' ? 'bg-gray-800/30' : ''}`}>
                        {/* Status toggle */}
                        <button
                          onClick={() => setStatus(task.id, task.status === 'done' ? 'pending' : 'done')}
                          disabled={updating === task.id}
                          className="flex-shrink-0 hover:scale-110 transition-transform disabled:opacity-50"
                        >
                          {updating === task.id
                            ? <Clock size={15} className="text-gray-500 animate-spin" />
                            : s.icon
                          }
                        </button>

                        {/* Task info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-gray-600 text-xs">{task.task_number}</span>
                            <p className={`text-sm ${s.text}`}>{task.task_name}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${TASK_TYPE_COLORS[task.task_type]}`}>
                              {task.task_type}
                            </span>
                            <span className="text-gray-600 text-xs">{task.phase_name}</span>
                            {isCurrentPhase && task.status !== 'done' && (
                              <span className="text-amber-400 text-xs font-medium">● Active phase</span>
                            )}
                          </div>
                        </div>

                        {/* Status selector */}
                        {task.status !== 'done' && (
                          <select
                            value={task.status}
                            onChange={e => setStatus(task.id, e.target.value as Task['status'])}
                            disabled={updating === task.id}
                            className="text-xs bg-gray-800 border border-gray-700 text-gray-400 rounded-lg px-2 py-1 focus:outline-none flex-shrink-0"
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="blocked">Blocked</option>
                            <option value="done">Done</option>
                          </select>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
