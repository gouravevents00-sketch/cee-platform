import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, CalendarDays, MapPin, User } from 'lucide-react'
import { PRODUCTION_STATUS_COLORS, PRODUCTION_STATUS_LABELS, PRODUCTION_SERVICE_LABELS, ProductionStatus, ProductionServiceType } from '@/lib/types'

export default async function ProductionProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const canSubmit = profile.role === 'director' || profile.role === 'admin'

  const { data: projects } = await supabase
    .from('production_orders')
    .select('*, assignee:profiles!production_orders_assigned_to_fkey(name)')
    .order('created_at', { ascending: false })

  const active = projects?.filter(p => p.status !== 'completed' && p.status !== 'cancelled') || []
  const done = projects?.filter(p => p.status === 'completed' || p.status === 'cancelled') || []

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Production Projects</h1>
          <p className="text-gray-500 text-sm mt-0.5">{active.length} active projects</p>
        </div>
        {canSubmit && (
          <Link href="/dashboard/production/new"
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
            <Plus size={16} />
            New Brief
          </Link>
        )}
      </div>

      {active.length > 0 && (
        <div className="mb-6">
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Active</h2>
          <div className="space-y-2">
            {active.map((p: any) => <ProjectCard key={p.id} project={p} />)}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div>
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Completed / Cancelled</h2>
          <div className="space-y-2">
            {done.map((p: any) => <ProjectCard key={p.id} project={p} />)}
          </div>
        </div>
      )}

      {projects?.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-500">No projects yet</p>
          {canSubmit && (
            <Link href="/dashboard/production/new" className="text-amber-500 text-sm mt-2 inline-block hover:text-amber-400">
              + Submit first brief
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project }: { project: any }) {
  return (
    <Link
      href={`/dashboard/production/projects/${project.id}`}
      className="block bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold">{project.event_name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRODUCTION_STATUS_COLORS[project.status as ProductionStatus]}`}>
              {PRODUCTION_STATUS_LABELS[project.status as ProductionStatus]}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-gray-400 text-xs">{project.client_name}</span>
            <span className="text-gray-500 text-xs flex items-center gap-1">
              <MapPin size={10} /> {project.event_city}
            </span>
            {project.event_date && (
              <span className="text-gray-500 text-xs flex items-center gap-1">
                <CalendarDays size={10} />
                {new Date(project.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
            {project.assignee?.name && (
              <span className="text-gray-500 text-xs flex items-center gap-1">
                <User size={10} /> {project.assignee.name}
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {project.quoted_amount ? (
            <p className="text-amber-400 font-semibold text-sm">₹{project.quoted_amount.toLocaleString('en-IN')}</p>
          ) : (
            <p className="text-gray-600 text-xs">Quote pending</p>
          )}
          <p className="text-gray-500 text-xs mt-1">{PRODUCTION_SERVICE_LABELS[project.service_type as ProductionServiceType]}</p>
        </div>
      </div>
    </Link>
  )
}
