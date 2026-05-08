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

  const tabCls = 'text-sm bg-gray-900 border border-gray-800 hover:border-gray-600 hover:text-white text-gray-300 px-4 py-2 rounded-xl transition-colors'
  const shortName = event.name?.length > 55 ? event.name.slice(0, 52) + '…' : event.name
  const shortNotes = event.notes?.length > 120 ? event.notes.slice(0, 117) + '…' : event.notes

  return (
    <div className="max-w-4xl mx-auto">

      {/* ── EVENT HEADER ─────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">

        {/* Top row: name + status + phase + actions */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-white text-xl font-bold leading-tight" title={event.name}>{shortName}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[event.status as keyof typeof STATUS_COLORS]}`}>
                {event.status}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${currentPhase?.color}`}>
                Phase {event.current_phase}: {currentPhase?.name}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-400">
              {event.clients?.name && (
                <span className="flex items-center gap-1"><Building2 size={12} /> {event.clients.name}</span>
              )}
              {event.event_date && (
                <span className="flex items-center gap-1">
                  <CalendarDays size={12} />
                  {new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {isDirector && (
                    <EventDateEditor eventId={id} currentDate={event.event_date} eventName={event.name}
                      hasTeam={(teamCount || 0) > 0} hasVendors={uniqueVendors.length > 0} />
                  )}
                </span>
              )}
              {event.venue && (
                <span className="flex items-center gap-1"><MapPin size={12} /> {event.venue}{event.city ? `, ${event.city}` : ''}</span>
              )}
              {event.poc?.name && (
                <span className="flex items-center gap-1.5">
                  <User size={12} /> POC: {event.poc.name}
                  {isDirector && (
                    <EmergencyPOCReplace eventId={id} eventName={event.name} currentPOCName={event.poc.name}
                      currentPOCId={event.poc_id} pocProfiles={(pocProfiles || []) as { id: string; name: string }[]} />
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {isDirector && <EventStatusUpdate eventId={id} currentStatus={event.status} />}
            {canRequestApproval && <RequestApprovalButton eventId={id} userId={user.id} />}
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{doneTasks}/{totalTasks} tasks complete</span>
            <span>{overallProgress}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>

        {/* Notes — truncated, only if present */}
        {shortNotes && (
          <p className="text-gray-600 text-xs mt-3 pt-3 border-t border-gray-800 leading-relaxed">{shortNotes}</p>
        )}

        {/* Director tools — compact row */}
        {isDirector && (
          <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap gap-2 items-center">
            <SaveAsTemplate eventId={id} eventName={event.name} />
            <BriefLinkGenerator eventId={id}
              clientName={event.clients?.contact_name || event.clients?.name}
              clientPhone={event.clients?.contact_phone}
              clientEmail={event.clients?.contact_email}
              eventType={event.type} eventDate={event.event_date} city={event.city} />
            <PortalLinkGenerator eventId={id} clientId={event.client_id} vendors={uniqueVendors} />
          </div>
        )}

        {event.status === 'completed' && isDirector && (
          <ReviewRequest eventName={event.name} clientName={event.clients?.contact_name || event.clients?.name} />
        )}
      </div>

      {/* ── WORKFLOW TABS — in process order ─────────────────────── */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {/* 1. Quotation — director only, first step */}
        {isDirector && (
          <Link href={`/dashboard/events/${id}/quotation`} className={tabCls}>Quotation</Link>
        )}
        {/* 2. Element Sheet — all team */}
        <Link href={`/dashboard/events/${id}/elements`} className={tabCls}>Elements</Link>
        {/* 3. Vendor SO — director + accounts */}
        {(isDirector || profile.role === 'accounts') && (
          <Link href={`/dashboard/events/${id}/so`} className={tabCls}>Vendor SO</Link>
        )}
        {/* 4. Artwork — non-accounts */}
        {profile.role !== 'accounts' && (
          <Link href={`/dashboard/events/${id}/artwork`} className={tabCls}>Artwork</Link>
        )}
        {/* 5. Team — director + admin */}
        {(isDirector || profile.role === 'admin') && (
          <Link href={`/dashboard/events/${id}/team`} className={tabCls}>Team</Link>
        )}
        {/* 6. Payments */}
        <Link href={`/dashboard/events/${id}/payments`} className={tabCls}>Payments</Link>
        {/* 7. Invoice — director + accounts */}
        {(isDirector || profile.role === 'accounts') && (
          <Link href={`/dashboard/events/${id}/invoice`} className={tabCls}>Invoice</Link>
        )}
        {/* 8. P&L — director + accounts */}
        {(isDirector || profile.role === 'accounts') && (
          <Link href={`/dashboard/events/${id}/pnl`} className={tabCls}>P&amp;L</Link>
        )}
        {/* 9. Agreement — director */}
        {isDirector && (
          <Link href={`/dashboard/events/${id}/contract`} className={tabCls}>Agreement</Link>
        )}
        {/* 10. Media — non-accounts */}
        {profile.role !== 'accounts' && (
          <Link href={`/dashboard/events/${id}/media`} className={tabCls}>Media</Link>
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
