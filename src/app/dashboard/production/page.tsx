import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, ClipboardList, Hammer, Megaphone, Store, Wand2, FileImage } from 'lucide-react'
import { PRODUCTION_SERVICES, ProductionServiceType } from '@/lib/types'

const SERVICE_ICONS: Record<ProductionServiceType, React.ElementType> = {
  stage: Hammer,
  branding: Megaphone,
  stall: Store,
  decor: Wand2,
  signage: FileImage,
}

export default async function ProductionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const canSubmit = profile.role === 'director' || profile.role === 'admin'

  const { count } = await supabase
    .from('production_orders')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'cancelled')
    .neq('status', 'completed')

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Production House</h1>
          <p className="text-gray-500 text-sm mt-0.5">Stage · Branding · Stalls · Decor · Signage</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/production/projects"
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            <ClipboardList size={16} />
            Projects{count ? ` (${count})` : ''}
          </Link>
          {canSubmit && (
            <Link
              href="/dashboard/production/new"
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              <Plus size={16} />
              New Brief
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PRODUCTION_SERVICES.map(service => {
          const Icon = SERVICE_ICONS[service.id]
          return (
            <div key={service.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${service.color}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold">{service.name}</h3>
                  <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{service.description}</p>
                </div>
              </div>
              <div className="bg-gray-800 rounded-xl px-3 py-2.5">
                <p className="text-gray-600 text-xs">Examples</p>
                <p className="text-gray-400 text-xs mt-0.5">{service.examples}</p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-gray-600 text-xs">Custom quote · project-based</span>
                {canSubmit && (
                  <Link
                    href={`/dashboard/production/new?service=${service.id}`}
                    className="text-amber-500 hover:text-amber-400 text-xs font-medium transition-colors"
                  >
                    Submit Brief →
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Materials note */}
      <div className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Materials We Work With</p>
        <div className="flex flex-wrap gap-2">
          {['Wood', 'Iron / MS', 'MDF', 'Flex', 'Fabric', 'Acrylic', 'Paint', 'PVC', 'Foam'].map(m => (
            <span key={m} className="bg-gray-800 text-gray-400 text-xs px-3 py-1 rounded-full">{m}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
