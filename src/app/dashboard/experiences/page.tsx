import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, ClipboardList, Zap, PenLine, Bot, Layers,
  Camera, RotateCw, Sparkles, Maximize2, Megaphone, Smartphone, LayoutGrid,
  Settings,
} from 'lucide-react'
import { EXPERIENCE_SERVICES, ServiceType } from '@/lib/types'

const SERVICE_ICONS: Record<ServiceType, React.ElementType> = {
  laser: Zap,
  sketch: PenLine,
  robo_arm: Bot,
  '3d_print': Layers,
  photo_booth: Camera,
  photo_360: RotateCw,
  glambot: Sparkles,
  mirror_booth: Maximize2,
  brand_activation: Megaphone,
  roaming_selfie: Smartphone,
  mosaic_wall: LayoutGrid,
}

// Services that have a digital operator panel built out
const OPERATOR_PANEL: Partial<Record<ServiceType, string>> = {
  photo_booth: '/dashboard/experiences/booth',
  brand_activation: '/dashboard/experiences/brand-activation',
}

export default async function ExperiencesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const isDirector = profile.role === 'director' || profile.role === 'admin'

  const { count } = await supabase
    .from('experience_orders')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'cancelled')

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Experiences</h1>
          <p className="text-gray-500 text-sm mt-0.5">Creative Era Experiences — event tech services</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/experiences/orders"
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            <ClipboardList size={16} />
            Orders{count ? ` (${count})` : ''}
          </Link>
          {isDirector && (
            <Link
              href="/dashboard/experiences/new"
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              <Plus size={16} />
              New Booking
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {EXPERIENCE_SERVICES.map(service => {
          const Icon = SERVICE_ICONS[service.id]
          const panelUrl = OPERATOR_PANEL[service.id]
          return (
            <div key={service.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${service.color}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold">{service.name}</h3>
                    {panelUrl && isDirector && (
                      <Link
                        href={panelUrl}
                        className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-full transition-colors"
                      >
                        <Settings size={10} /> Operator
                      </Link>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{service.description}</p>
                </div>
              </div>

              <div className="space-y-2">
                {service.packages.map(pkg => (
                  <div key={pkg.name} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2.5">
                    <div>
                      <span className="text-white text-sm font-medium">{pkg.name}</span>
                      <span className="text-gray-500 text-xs ml-2">{pkg.duration}</span>
                      {pkg.pieces && (
                        <span className="text-gray-600 text-xs ml-2">· {pkg.pieces} pcs</span>
                      )}
                    </div>
                    <span className="text-amber-400 text-sm font-semibold">
                      ₹{pkg.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
                {service.extra_piece_rate && (
                  <p className="text-gray-600 text-xs px-1">+ ₹{service.extra_piece_rate}/extra piece</p>
                )}
              </div>

              {isDirector && (
                <Link
                  href={`/dashboard/experiences/new?service=${service.id}`}
                  className="mt-4 block text-center bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
                >
                  Book This Service
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
