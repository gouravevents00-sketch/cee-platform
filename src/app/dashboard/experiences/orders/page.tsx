import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, CalendarDays, MapPin, User } from 'lucide-react'
import { ORDER_STATUS_COLORS, SERVICE_LABELS, OrderStatus, ServiceType } from '@/lib/types'

export default async function ExperienceOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const canBook = profile.role === 'director' || profile.role === 'admin'

  let query = supabase
    .from('experience_orders')
    .select('*, operator:profiles!experience_orders_operator_id_fkey(name)')
    .order('created_at', { ascending: false })

  if (profile.role === 'poc') query = query.eq('operator_id', user.id)

  const { data: orders } = await query

  const active = orders?.filter(o => o.status !== 'completed' && o.status !== 'cancelled') || []
  const done = orders?.filter(o => o.status === 'completed' || o.status === 'cancelled') || []

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Experience Orders</h1>
          <p className="text-gray-500 text-sm mt-0.5">{active.length} active bookings</p>
        </div>
        {canBook && (
          <Link
            href="/dashboard/experiences/new"
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            <Plus size={16} />
            New Booking
          </Link>
        )}
      </div>

      {active.length > 0 && (
        <div className="mb-6">
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Active</h2>
          <div className="space-y-2">
            {active.map((order: any) => <OrderCard key={order.id} order={order} />)}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div>
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Completed / Cancelled</h2>
          <div className="space-y-2">
            {done.map((order: any) => <OrderCard key={order.id} order={order} />)}
          </div>
        </div>
      )}

      {orders?.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-500">No orders yet</p>
          {canBook && (
            <Link href="/dashboard/experiences/new" className="text-amber-500 text-sm mt-2 inline-block hover:text-amber-400">
              + Create first booking
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function OrderCard({ order }: { order: any }) {
  return (
    <Link
      href={`/dashboard/experiences/orders/${order.id}`}
      className="block bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold">{order.event_name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS_COLORS[order.status as OrderStatus]}`}>
              {order.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-gray-400 text-xs">{order.client_name}</span>
            <span className="text-gray-500 text-xs flex items-center gap-1">
              <MapPin size={10} /> {order.event_city}
            </span>
            <span className="text-gray-500 text-xs flex items-center gap-1">
              <CalendarDays size={10} />
              {new Date(order.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {order.operator?.name && (
              <span className="text-gray-500 text-xs flex items-center gap-1">
                <User size={10} /> {order.operator.name}
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-amber-400 font-semibold text-sm">₹{order.total_amount.toLocaleString('en-IN')}</p>
          <p className="text-gray-500 text-xs mt-1">{SERVICE_LABELS[order.service_type as ServiceType]} · {order.package_name}</p>
        </div>
      </div>
    </Link>
  )
}
