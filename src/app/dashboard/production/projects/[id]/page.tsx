import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, MapPin, Phone, User, Ruler, Box } from 'lucide-react'
import { PRODUCTION_STATUS_COLORS, PRODUCTION_STATUS_LABELS, PRODUCTION_SERVICE_LABELS, ProductionStatus, ProductionServiceType } from '@/lib/types'
import ProjectActions from './ProjectActions'

export default async function ProductionProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: project } = await supabase
    .from('production_orders')
    .select('*, assignee:profiles!production_orders_assigned_to_fkey(id, name)')
    .eq('id', id)
    .single()

  if (!project) notFound()

  const { data: team } = await supabase
    .from('profiles')
    .select('id, name, role')
    .in('role', ['poc', 'admin', 'director'])

  const isDirector = profile.role === 'director'
  const canManage = profile.role === 'director' || profile.role === 'admin'

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/production/projects" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-white text-2xl font-bold">{project.event_name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{project.client_name}</p>
        </div>
      </div>

      {/* Status + Amount */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${PRODUCTION_STATUS_COLORS[project.status as ProductionStatus]}`}>
            {PRODUCTION_STATUS_LABELS[project.status as ProductionStatus]}
          </span>
          <div className="text-right">
            {project.quoted_amount ? (
              <div>
                <p className="text-gray-500 text-xs">Quoted</p>
                <p className="text-amber-400 text-xl font-bold">₹{project.quoted_amount.toLocaleString('en-IN')}</p>
              </div>
            ) : (
              <p className="text-gray-600 text-sm">Quote pending</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-xs">Service{project.service_types?.length > 1 ? 's' : ''}</p>
            {project.service_types && Array.isArray(project.service_types) && project.service_types.length > 1 ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {(project.service_types as string[]).map((t: string) => (
                  <span key={t} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
                    {PRODUCTION_SERVICE_LABELS[t as ProductionServiceType]}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-white text-sm font-medium mt-0.5">{PRODUCTION_SERVICE_LABELS[project.service_type as ProductionServiceType]}</p>
            )}
          </div>
          {project.assignee?.name && (
            <div>
              <p className="text-gray-500 text-xs">Assigned To</p>
              <p className="text-white text-sm font-medium mt-0.5">{project.assignee.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Event Details */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Event & Contact</h2>
        <div className="space-y-3">
          {project.event_date && (
            <div className="flex items-center gap-3">
              <CalendarDays size={15} className="text-gray-500 flex-shrink-0" />
              <span className="text-white text-sm">
                {new Date(project.event_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <MapPin size={15} className="text-gray-500 flex-shrink-0" />
            <span className="text-white text-sm">{project.event_city}</span>
          </div>
          <div className="flex items-center gap-3">
            <User size={15} className="text-gray-500 flex-shrink-0" />
            <span className="text-white text-sm">{project.contact_name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone size={15} className="text-gray-500 flex-shrink-0" />
            <span className="text-white text-sm">{project.contact_phone}</span>
          </div>
        </div>
      </div>

      {/* Brief */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Project Brief</h2>
        <p className="text-gray-300 text-sm leading-relaxed">{project.brief}</p>
        {(project.dimensions || project.material_preference) && (
          <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-4">
            {project.dimensions && (
              <div className="flex items-start gap-2">
                <Ruler size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-500 text-xs">Dimensions</p>
                  <p className="text-white text-sm mt-0.5">{project.dimensions}</p>
                </div>
              </div>
            )}
            {project.material_preference && (
              <div className="flex items-start gap-2">
                <Box size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-500 text-xs">Material</p>
                  <p className="text-white text-sm mt-0.5">{project.material_preference}</p>
                </div>
              </div>
            )}
          </div>
        )}
        {isDirector && project.internal_notes && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-gray-500 text-xs mb-1">Internal Notes</p>
            <p className="text-gray-400 text-sm">{project.internal_notes}</p>
          </div>
        )}
      </div>

      {canManage && (
        <ProjectActions
          projectId={project.id}
          currentStatus={project.status}
          currentAssigneeId={project.assignee?.id || null}
          currentQuote={project.quoted_amount || null}
          currentNotes={project.internal_notes || ''}
          team={team || []}
          isDirector={isDirector}
        />
      )}
    </div>
  )
}
