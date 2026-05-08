import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PHASES, STATUS_COLORS } from '@/lib/types'
import { CalendarDays, MapPin, User, Building2 } from 'lucide-react'
import PhaseTracker from './PhaseTracker'
import EventStatusUpdate from './EventStatusUpdate'
import RequestApprovalButton from '@/components/RequestApprovalButton'
import ActivityLog from '@/components/ActivityLog'
import ReviewRequest from '@/components/ReviewRequest'
import PortalLinkGenerator from '@/components/PortalLinkGenerator'
import BriefLinkGenerator from '@/components/BriefLinkGenerator'
import SaveAsTemplate from '@/components/SaveAsTemplate'
import EventDateEditor from '@/components/EventDateEditor'
import EmergencyPOCReplace from '@/components/EmergencyPOCReplace'
import Link from 'next/link'

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('*, clients(*), poc:profiles!events_poc_id_fkey(name, email)')
    .eq('id', id)
    .single()

  if (!event) notFound()

  if (profile.role === 'poc' && event.poc_id !== user.id) redirect('/dashboard')

  const { data: tasks } = await supabase
    .from('event_tasks')
    .select('*')
    .eq('event_id', id)
    .order('phase')
    .order('task_number')

  const tasksByPhase: Record<number, any[]> = {}
  tasks?.forEach(task => {
    if (!tasksByPhase[task.phase]) tasksByPhase[task.phase] = []
    tasksByPhase[task.phase].push(task)
  })

  const totalTasks = tasks?.length || 0
  const doneTasks = tasks?.filter(t => t.status === 'done').length || 0
  const overallProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const isDirector = profile.role === 'director'
  const canRequestApproval = ['poc', 'design', 'admin', 'accounts'].includes(profile.role)
  const currentPhase = PHASES[event.current_phase]

  // Fetch POC profiles for emergency replacement (director only)
  const { data: pocProfiles } = isDirector
    ? await supabase.from('profiles').select('id, name').eq('role', 'poc').order('name')
    : { data: [] }

  // Check if event has team members (for date change impact warning)
  const { count: teamCount } = isDirector
    ? await supabase.from('event_team').select('id', { count: 'exact', head: true }).eq('event_id', id)
    : { count: 0 }

  // Fetch vendors with elements for this event (for portal links)
  const { data: eventVendors } = isDirector ? await supabase
    .from('elements')
    .select('vendor_id, vendors(id, name, category)')
    .eq('event_id', id)
    .not('vendor_id', 'is', null) : { data: [] }

  const uniqueVendors = isDirector ? Object.values(
    ((eventVendors || []) as any[]).reduce((acc: any, el: any) => {
      if (el.vendor_id && el.vendors) acc[el.vendor_id] = el.vendors
      return acc
    }, {})
  ) as { id: string; name: string; category?: string }[] : []

  return (
    <div className="max-w-4xl mx-auto">
      {/* Event Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h1 className="text-white text-xl font-bold">{event.name}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[event.status as keyof typeof STATUS_COLORS]}`}>
                {event.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-400">
              {event.clients?.name && (
                <span className="flex items-center gap-1"><Building2 size={13} /> {event.clients.name}</span>
              )}
              {event.venue && (
                <span className="flex items-center gap-1"><MapPin size={13} /> {event.venue}{event.city ? `, ${event.city}` : ''}</span>
              )}
              {event.event_date && (
                <span className="flex items-center gap-1">
                  <CalendarDays size={13} />
                  {new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {isDirector && (
                    <EventDateEditor
                      eventId={id}
                      currentDate={event.event_date}
                      eventName={event.name}
                      hasTeam={(teamCount || 0) > 0}
                      hasVendors={uniqueVendors.length > 0}
                    />
                  )}
                </span>
              )}
              {event.poc?.name && (
                <span className="flex items-center gap-1.5">
                  <User size={13} />
                  POC: {event.poc.name}
                  {isDirector && (
                    <EmergencyPOCReplace
                      eventId={id}
                      eventName={event.name}
                      currentPOCName={event.poc.name}
                      currentPOCId={event.poc_id}
                      pocProfiles={(pocProfiles || []) as { id: string; name: string }[]}
                    />
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Right side: phase tag + actions */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${currentPhase?.color}`}>
              {currentPhase?.name}
            </span>
            {isDirector && (
              <EventStatusUpdate eventId={id} currentStatus={event.status} />
            )}
            {canRequestApproval && (
              <RequestApprovalButton eventId={id} userId={user.id} />
            )}
          </div>
        </div>

        {/* Overall Progress */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>{doneTasks}/{totalTasks} tasks complete</span>
            <span>{overallProgress}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {event.notes && (
          <div className="mt-3 pt-3 border-t border-gray-800">
            <p className="text-gray-500 text-xs">{event.notes}</p>
          </div>
        )}

        {/* Google Review Request — completed events only */}
        {event.status === 'completed' && isDirector && (
          <ReviewRequest
            eventName={event.name}
            clientName={event.clients?.contact_name || event.clients?.name}
          />
        )}

        {/* Save as Template — director only */}
        {isDirector && (
          <div className="mt-3 pt-3 border-t border-gray-800 flex justify-end">
            <SaveAsTemplate eventId={id} eventName={event.name} />
          </div>
        )}

        {/* Brief Link Generator — director only */}
        {isDirector && (
          <BriefLinkGenerator
            eventId={id}
            clientName={event.clients?.contact_name || event.clients?.name}
            clientPhone={event.clients?.contact_phone}
            clientEmail={event.clients?.contact_email}
            eventType={event.type}
            eventDate={event.event_date}
            city={event.city}
          />
        )}

        {/* Portal Link Generator — director only */}
        {isDirector && (
          <PortalLinkGenerator
            eventId={id}
            clientId={event.client_id}
            vendors={uniqueVendors}
          />
        )}
      </div>

      {/* Quick Links */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Link
          href={`/dashboard/events/${id}/elements`}
          className="text-sm bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 px-4 py-2 rounded-xl transition-colors"
        >
          Element Sheet
        </Link>
        <Link
          href={`/dashboard/events/${id}/payments`}
          className="text-sm bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 px-4 py-2 rounded-xl transition-colors"
        >
          Payments
        </Link>
        {(isDirector || profile.role === 'accounts') && (
          <Link
            href={`/dashboard/events/${id}/so`}
            className="text-sm bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 px-4 py-2 rounded-xl transition-colors"
          >
            Vendor SO
          </Link>
        )}
        {isDirector && (
          <Link
            href={`/dashboard/events/${id}/quotation`}
            className="text-sm bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 px-4 py-2 rounded-xl transition-colors"
          >
            Quotation
          </Link>
        )}
        {(isDirector || profile.role === 'accounts') && (
          <Link
            href={`/dashboard/events/${id}/invoice`}
            className="text-sm bg-gray-900 border border-amber-900/30 hover:border-amber-700/60 text-amber-400 px-4 py-2 rounded-xl transition-colors"
          >
            Invoice
          </Link>
        )}
        {(isDirector || profile.role === 'accounts') && (
          <Link
            href={`/dashboard/events/${id}/pnl`}
            className="text-sm bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 px-4 py-2 rounded-xl transition-colors"
          >
            P&L
          </Link>
        )}
        {isDirector && (
          <Link
            href={`/dashboard/events/${id}/contract`}
            className="text-sm bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 px-4 py-2 rounded-xl transition-colors"
          >
            Agreement
          </Link>
        )}
        {/* Team — director + admin */}
        {(isDirector || profile.role === 'admin') && (
          <Link
            href={`/dashboard/events/${id}/team`}
            className="text-sm bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 px-4 py-2 rounded-xl transition-colors"
          >
            Team
          </Link>
        )}
        {/* Artwork — all except accounts */}
        {profile.role !== 'accounts' && (
          <Link
            href={`/dashboard/events/${id}/artwork`}
            className="text-sm bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 px-4 py-2 rounded-xl transition-colors"
          >
            Artwork
          </Link>
        )}
        {/* Media — all except accounts */}
        {profile.role !== 'accounts' && (
          <Link
            href={`/dashboard/events/${id}/media`}
            className="text-sm bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 px-4 py-2 rounded-xl transition-colors"
          >
            Media
          </Link>
        )}
      </div>

      {/* Phase Tracker */}
      <PhaseTracker
        eventId={id}
        tasksByPhase={tasksByPhase}
        currentPhase={event.current_phase}
        userRole={profile.role}
        userId={user.id}
        isDirector={isDirector}
      />

      <ActivityLog eventId={id} />
    </div>
  )
}
