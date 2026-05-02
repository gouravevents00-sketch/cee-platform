import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, CalendarDays, MapPin } from 'lucide-react'
import { PHASES, STATUS_COLORS } from '@/lib/types'

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const isDirector = profile.role === 'director'

  let query = supabase
    .from('events')
    .select('*, clients(name, type), poc:profiles!events_poc_id_fkey(name)')
    .order('event_date', { ascending: true })

  if (profile.role === 'poc') query = query.eq('poc_id', user.id)

  const { data: events } = await query

  const active = events?.filter(e => e.status === 'active' || e.status === 'execution' || e.status === 'enquiry') || []
  const completed = events?.filter(e => e.status === 'completed') || []

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Events</h1>
          <p className="text-gray-500 text-sm mt-0.5">{active.length} active, {completed.length} completed</p>
        </div>
        {isDirector && (
          <Link
            href="/dashboard/events/new"
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            <Plus size={16} />
            New Event
          </Link>
        )}
      </div>

      {/* Active Events */}
      {active.length > 0 && (
        <div className="mb-6">
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Active</h2>
          <div className="space-y-2">
            {active.map((event: any) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* Completed Events */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Completed</h2>
          <div className="space-y-2">
            {completed.map((event: any) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      {events?.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-500">No events found</p>
          {isDirector && (
            <Link href="/dashboard/events/new" className="text-amber-500 text-sm mt-2 inline-block hover:text-amber-400">
              + Create your first event
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function EventCard({ event }: { event: any }) {
  const phase = PHASES[event.current_phase]
  const progressPercent = Math.round((event.current_phase / 7) * 100)

  return (
    <Link
      href={`/dashboard/events/${event.id}`}
      className="block bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold">{event.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[event.status as keyof typeof STATUS_COLORS]}`}>
              {event.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {event.clients?.name && (
              <span className="text-gray-400 text-xs">{event.clients.name}</span>
            )}
            {event.venue && (
              <span className="text-gray-500 text-xs flex items-center gap-1">
                <MapPin size={10} /> {event.venue}{event.city ? `, ${event.city}` : ''}
              </span>
            )}
            {event.event_date && (
              <span className="text-gray-500 text-xs flex items-center gap-1">
                <CalendarDays size={10} />
                {new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${phase?.color || 'bg-gray-800 text-gray-400'}`}>
            {phase?.name || 'Phase 0'}
          </span>
          {event.poc?.name && (
            <p className="text-gray-500 text-xs mt-1.5">POC: {event.poc.name}</p>
          )}
        </div>
      </div>

      {/* Phase progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Phase {event.current_phase}/7</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </Link>
  )
}
