'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalendarEvent {
  id: string
  name: string
  event_date: string
  status: string
  clients?: { name: string }
  city?: string
}

interface Props {
  events: CalendarEvent[]
}

const STATUS_COLORS: Record<string, string> = {
  enquiry: 'bg-gray-700 text-gray-300',
  active: 'bg-blue-900/70 text-blue-300',
  execution: 'bg-orange-900/70 text-orange-300',
  completed: 'bg-green-900/70 text-green-300',
  cancelled: 'bg-red-900/70 text-red-400 line-through',
}

const STATUS_DOT: Record<string, string> = {
  enquiry: 'bg-gray-400',
  active: 'bg-blue-400',
  execution: 'bg-orange-400',
  completed: 'bg-green-400',
  cancelled: 'bg-red-400',
}

export default function CalendarView({ events }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = new Date(year, month).toLocaleString('en-IN', { month: 'long' })

  // Map events by date string
  const eventsByDate: Record<string, CalendarEvent[]> = {}
  events.forEach(ev => {
    if (!ev.event_date) return
    const d = new Date(ev.event_date)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate().toString()
      if (!eventsByDate[key]) eventsByDate[key] = []
      eventsByDate[key].push(ev)
    }
  })

  // Build grid cells: empty slots + day numbers
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const todayDate = today.getDate()
  const todayMonth = today.getMonth()
  const todayYear = today.getFullYear()

  // Events this month for sidebar
  const monthEvents = events
    .filter(ev => {
      if (!ev.event_date) return false
      const d = new Date(ev.event_date)
      return d.getFullYear() === year && d.getMonth() === month
    })
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl transition-colors text-gray-400 hover:text-white">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-white text-xl font-bold w-44 text-center">{monthName} {year}</h2>
          <button onClick={nextMonth} className="p-2 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl transition-colors text-gray-400 hover:text-white">
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()) }}
          className="text-xs bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white px-3 py-2 rounded-xl transition-colors"
        >
          Today
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        {/* Calendar Grid */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {/* Day labels */}
          <div className="grid grid-cols-7 border-b border-gray-800">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="py-3 text-center text-xs text-gray-500 font-medium uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) return (
                <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-gray-800/50 last:border-r-0" />
              )
              const isToday = day === todayDate && month === todayMonth && year === todayYear
              const dayEvents = eventsByDate[day.toString()] || []
              const isPast = new Date(year, month, day) < new Date(todayYear, todayMonth, todayDate)

              return (
                <div
                  key={day}
                  className={`min-h-[80px] p-1.5 border-b border-r border-gray-800/50 last:border-r-0 ${isPast && !isToday ? 'opacity-60' : ''}`}
                >
                  <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                    isToday ? 'bg-amber-500 text-black' : 'text-gray-400'
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => (
                      <Link
                        key={ev.id}
                        href={`/dashboard/events/${ev.id}`}
                        className={`block text-[10px] leading-tight px-1.5 py-0.5 rounded truncate font-medium hover:opacity-80 transition-opacity ${STATUS_COLORS[ev.status] || 'bg-gray-700 text-gray-300'}`}
                        title={ev.name}
                      >
                        {ev.name}
                      </Link>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[10px] text-gray-600 pl-1">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Month Events List */}
        <div className="space-y-3">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
              {monthName} Events ({monthEvents.length})
            </p>
            {monthEvents.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-4">No events this month</p>
            ) : (
              <div className="space-y-2">
                {monthEvents.map(ev => (
                  <Link
                    key={ev.id}
                    href={`/dashboard/events/${ev.id}`}
                    className="flex items-start gap-3 p-3 bg-gray-800 hover:bg-gray-800/70 rounded-xl transition-colors group"
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${STATUS_DOT[ev.status] || 'bg-gray-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate group-hover:text-amber-400 transition-colors">
                        {ev.name}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {new Date(ev.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {ev.clients?.name && ` · ${ev.clients.name}`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">Legend</p>
            <div className="space-y-1.5">
              {Object.entries({ enquiry: 'Enquiry', active: 'Active', execution: 'Execution', completed: 'Completed', cancelled: 'Cancelled' }).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[k]}`} />
                  <span className="text-gray-400 text-xs">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
