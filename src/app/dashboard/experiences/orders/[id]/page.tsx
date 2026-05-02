import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, MapPin, Phone, User } from 'lucide-react'
import { ORDER_STATUS_COLORS, SERVICE_LABELS, OrderStatus, ServiceType } from '@/lib/types'
import OrderActions from './OrderActions'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: order } = await supabase
    .from('experience_orders')
    .select('*, operator:profiles!experience_orders_operator_id_fkey(id, name)')
    .eq('id', id)
    .single()

  if (!order) notFound()

  const { data: operators } = await supabase
    .from('profiles')
    .select('id, name, role')
    .in('role', ['poc', 'admin', 'director'])

  const isDirector = profile.role === 'director'
  const canManage = profile.role === 'director' || profile.role === 'admin'

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/experiences/orders" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-white text-2xl font-bold">{order.event_name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{order.client_name}</p>
        </div>
      </div>

      {/* Status + Amount */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${ORDER_STATUS_COLORS[order.status as OrderStatus]}`}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
          <span className="text-amber-400 text-xl font-bold">₹{order.total_amount.toLocaleString('en-IN')}</span>
        </div>

        {/* Multi-item breakdown */}
        {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
          <div className="space-y-2">
            {(order.items as any[]).map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2.5">
                <div>
                  <span className="text-white text-sm font-medium">{SERVICE_LABELS[item.service_type as ServiceType]}</span>
                  <span className="text-gray-500 text-xs ml-2">· {item.package_name}</span>
                  {item.pieces_included && <span className="text-gray-600 text-xs ml-1">· {item.pieces_included} pcs</span>}
                  {item.extra_pieces > 0 && <span className="text-gray-600 text-xs ml-1">+{item.extra_pieces} extra</span>}
                </div>
                <span className="text-amber-400 text-sm font-semibold">₹{item.amount.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        ) : (
          /* Single service (old orders) */
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-500 text-xs">Service</p>
              <p className="text-white text-sm font-medium mt-0.5">{SERVICE_LABELS[order.service_type as ServiceType]}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Package</p>
              <p className="text-white text-sm font-medium mt-0.5">{order.package_name}</p>
            </div>
            {order.pieces_included && (
              <div>
                <p className="text-gray-500 text-xs">Pieces Included</p>
                <p className="text-white text-sm font-medium mt-0.5">{order.pieces_included}</p>
              </div>
            )}
          </div>
        )}

        {order.operator?.name && (
          <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-2">
            <User size={13} className="text-gray-500" />
            <span className="text-gray-500 text-xs">Operator:</span>
            <span className="text-amber-400 text-xs font-medium">{order.operator.name}</span>
          </div>
        )}
      </div>

      {/* Event Details */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Event Details</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <CalendarDays size={15} className="text-gray-500 flex-shrink-0" />
            <span className="text-white text-sm">
              {new Date(order.event_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <MapPin size={15} className="text-gray-500 flex-shrink-0" />
            <span className="text-white text-sm">{order.event_city}</span>
          </div>
          <div className="flex items-center gap-3">
            <User size={15} className="text-gray-500 flex-shrink-0" />
            <span className="text-white text-sm">{order.contact_name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone size={15} className="text-gray-500 flex-shrink-0" />
            <span className="text-white text-sm">{order.contact_phone}</span>
          </div>
          {order.operator?.name && (
            <div className="flex items-center gap-3">
              <User size={15} className="text-gray-500 flex-shrink-0" />
              <span className="text-white text-sm">Operator: <span className="text-amber-400">{order.operator.name}</span></span>
            </div>
          )}
        </div>
        {order.special_notes && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-gray-500 text-xs mb-1">Notes</p>
            <p className="text-gray-300 text-sm">{order.special_notes}</p>
          </div>
        )}
      </div>

      {canManage && (
        <OrderActions
          orderId={order.id}
          currentStatus={order.status}
          currentOperatorId={order.operator?.id || null}
          operators={operators || []}
          isDirector={isDirector}
        />
      )}
    </div>
  )
}
