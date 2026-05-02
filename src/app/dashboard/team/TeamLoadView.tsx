'use client'

import Link from 'next/link'
import { CalendarDays, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { ROLE_LABELS, Role } from '@/lib/types'

interface TeamMember {
  id: string
  name: string
  role: Role
  email: string
}

interface EventRow {
  id: string
  name: string
  event_date?: string
  status: string
  poc_id?: string
  poc?: { id: string; name: string; role: string } | null
}

interface Props {
  team: TeamMember[]
  activeEvents: EventRow[]
}

const ROLE_COLORS: Record<Role, string> = {
  director: 'bg-amber-900/50 text-amber-400',
  admin: 'bg-blue-900/50 text-blue-400',
  design: 'bg-purple-900/50 text-purple-400',
  poc: 'bg-green-900/50 text-green-400',
  accounts: 'bg-orange-900/50 text-orange-400',
}

const STATUS_COLORS: Record<string, string> = {
  enquiry: 'text-gray-400',
  active: 'text-blue-400',
  execution: 'text-orange-400',
}

const today = new Date()
today.setHours(0, 0, 0, 0)

function daysUntil(dateStr?: string) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / 86400000)
}

export default function TeamLoadView({ team, activeEvents }: Props) {
  // Group events by poc_id
  const eventsByPoc: Record<string, EventRow[]> = {}
  activeEvents.forEach(ev => {
    const key = ev.poc_id || 'unassigned'
    if (!eventsByPoc[key]) eventsByPoc[key] = []
    eventsByPoc[key].push(ev)
  })

  const unassigned = eventsByPoc['unassigned'] || []

  // Sort team: most loaded first
  const sorted = [...team].sort((a, b) =>
    (eventsByPoc[b.id]?.length || 0) - (eventsByPoc[a.id]?.length || 0)
  )

  const maxLoad = Math.max(...sorted.map(m => eventsByPoc[m.id]?.length || 0), 1)

  return (
    <div className="space-y-4 mb-2">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold">Team Load</h2>
        <span className="text-gray-500 text-xs">{activeEvents.length} active events</span>
      </div>

      <div className="grid gap-3">
        {sorted.map(member => {
          const memberEvents = eventsByPoc[member.id] || []
          const load = memberEvents.length
          const loadPct = maxLoad > 0 ? (load / maxLoad) * 100 : 0
          const urgent = memberEvents.filter(e => {
            const d = daysUntil(e.event_date)
            return d !== null && d <= 7 && d >= 0
          })

          return (
            <div key={member.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium text-sm">{member.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[member.role]}`}>
                        {ROLE_LABELS[member.role]}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {urgent.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-950 px-2 py-1 rounded-lg">
                      <AlertTriangle size={10} /> {urgent.length} urgent
                    </span>
                  )}
                  <span className={`text-sm font-bold ${load === 0 ? 'text-gray-600' : load >= 3 ? 'text-orange-400' : 'text-white'}`}>
                    {load} event{load !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Load bar */}
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${load === 0 ? 'bg-gray-700' : load >= 3 ? 'bg-orange-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.max(loadPct, load > 0 ? 8 : 0)}%` }}
                />
              </div>

              {/* Events list */}
              {memberEvents.length > 0 ? (
                <div className="space-y-1.5">
                  {memberEvents.map(ev => {
                    const days = daysUntil(ev.event_date)
                    return (
                      <Link
                        key={ev.id}
                        href={`/dashboard/events/${ev.id}`}
                        className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-xs ${STATUS_COLORS[ev.status] || 'text-gray-400'}`}>●</span>
                          <p className="text-gray-300 text-xs truncate group-hover:text-white transition-colors">{ev.name}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {ev.event_date && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <CalendarDays size={10} />
                              {days === null ? '' :
                               days < 0 ? <span className="text-gray-600">Past</span> :
                               days === 0 ? <span className="text-red-400 font-semibold">Today!</span> :
                               days <= 3 ? <span className="text-red-400 font-semibold">in {days}d</span> :
                               days <= 7 ? <span className="text-orange-400">in {days}d</span> :
                               <span>in {days}d</span>
                              }
                            </span>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <p className="text-gray-700 text-xs text-center py-1">No active events</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Unassigned events */}
      {unassigned.length > 0 && (
        <div className="bg-gray-900 border border-red-900/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-red-400" />
            <p className="text-red-400 font-semibold text-sm">Unassigned Events ({unassigned.length})</p>
          </div>
          <div className="space-y-1.5">
            {unassigned.map(ev => (
              <Link
                key={ev.id}
                href={`/dashboard/events/${ev.id}`}
                className="flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors group"
              >
                <p className="text-gray-300 text-xs group-hover:text-white transition-colors">{ev.name}</p>
                {ev.event_date && (
                  <span className="text-xs text-gray-500">
                    {new Date(ev.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
