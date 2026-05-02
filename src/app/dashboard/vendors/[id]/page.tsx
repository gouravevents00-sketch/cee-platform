import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Truck, Phone, CalendarDays, IndianRupee, Package, Star } from 'lucide-react'
import VendorRating from './VendorActions'
import DeleteVendorButton from './DeleteVendorButton'

const CATEGORY_COLORS: Record<string, string> = {
  printing: 'bg-blue-900/50 text-blue-400',
  fabrication: 'bg-purple-900/50 text-purple-400',
  av: 'bg-orange-900/50 text-orange-400',
  lighting: 'bg-yellow-900/50 text-yellow-400',
  manpower: 'bg-green-900/50 text-green-400',
  transport: 'bg-pink-900/50 text-pink-400',
  catering: 'bg-red-900/50 text-red-400',
  other: 'bg-gray-800 text-gray-400',
}

export default async function VendorCRMPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['director', 'accounts'].includes(profile.role)) redirect('/dashboard')

  const { data: vendor } = await supabase.from('vendors').select('*').eq('id', id).single()
  if (!vendor) notFound()

  // Elements this vendor has been assigned across events
  const { data: elements } = await supabase
    .from('elements')
    .select('*, events(id, name, event_date, status)')
    .eq('vendor_id', id)
    .order('created_at', { ascending: false })

  // Vendor payments
  const { data: payments } = await supabase
    .from('vendor_payments')
    .select('*, events(id, name, event_date)')
    .eq('vendor_id', id)
    .order('created_at', { ascending: false })

  // Unique events this vendor has worked on
  const eventMap: Record<string, any> = {}
  ;(elements || []).forEach(el => {
    if (el.events) eventMap[el.events.id] = el.events
  })
  ;(payments || []).forEach(p => {
    if (p.events) eventMap[p.events.id] = p.events
  })
  const workedEvents = Object.values(eventMap).sort((a, b) =>
    new Date(b.event_date || 0).getTime() - new Date(a.event_date || 0).getTime()
  )

  // Payment aggregates
  const totalAssigned = (payments || []).reduce((s, p) => s + p.amount, 0)
  const totalPaid = (payments || []).filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const totalPending = totalAssigned - totalPaid
  const totalItems = (elements || []).length

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`
  const isDirector = profile.role === 'director'

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-5">
        <Link href="/dashboard/vendors" className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} /> Vendors
        </Link>
      </div>

      {/* Vendor Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center flex-shrink-0">
              <Truck size={20} className="text-gray-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-white text-xl font-bold">{vendor.name}</h1>
                {vendor.category && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${CATEGORY_COLORS[vendor.category] || CATEGORY_COLORS.other}`}>
                    {vendor.category}
                  </span>
                )}
              </div>
              {vendor.contact_name && <p className="text-gray-400 text-sm">{vendor.contact_name}</p>}
              {vendor.contact_phone && (
                <p className="text-gray-500 text-sm flex items-center gap-1.5 mt-0.5">
                  <Phone size={12} /> {vendor.contact_phone}
                </p>
              )}
              {vendor.notes && <p className="text-gray-600 text-xs mt-2 italic">{vendor.notes}</p>}
            </div>
          </div>
          {/* Reliability Score + Delete — director only */}
          <div className="flex-shrink-0 flex flex-col items-end gap-3">
            <div>
              <p className="text-gray-500 text-xs mb-2 text-right">Reliability</p>
              {isDirector ? (
                <VendorRating vendorId={id} currentScore={vendor.reliability_score} />
              ) : (
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={16} className={s <= vendor.reliability_score ? 'text-amber-400 fill-amber-400' : 'text-gray-700'} />
                  ))}
                </div>
              )}
            </div>
            {isDirector && <DeleteVendorButton vendorId={id} />}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Events Worked" value={workedEvents.length.toString()} icon={<CalendarDays size={14} />} color="text-white" />
        <StatCard label="Total Items" value={totalItems.toString()} icon={<Package size={14} />} color="text-white" />
        <StatCard label="Total Paid" value={fmt(totalPaid)} icon={<IndianRupee size={14} />} color="text-green-400" />
        <StatCard label="Pending" value={fmt(totalPending)} icon={<IndianRupee size={14} />} color={totalPending > 0 ? 'text-amber-400' : 'text-gray-400'} />
      </div>

      {/* Payment History */}
      {(payments || []).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-5">
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Payment History</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {(payments as any[]).map(p => (
              <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div>
                  <p className="text-white text-sm font-medium">{p.events?.name || 'Unknown event'}</p>
                  {p.events?.event_date && (
                    <p className="text-gray-500 text-xs">
                      {new Date(p.events.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                  {p.notes && <p className="text-gray-600 text-xs italic">{p.notes}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white font-semibold">{fmt(p.amount)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.status === 'paid' ? 'bg-green-900/50 text-green-400' :
                    p.status === 'overdue' ? 'bg-red-900/50 text-red-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events Worked */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Events Worked</h3>
          <p className="text-gray-500 text-xs mt-0.5">{workedEvents.length} events</p>
        </div>
        {workedEvents.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">Not assigned to any events yet</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {workedEvents.map((ev: any) => (
              <Link
                key={ev.id}
                href={`/dashboard/events/${ev.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-800/40 transition-colors group"
              >
                <div>
                  <p className="text-white text-sm font-medium group-hover:text-amber-400 transition-colors">{ev.name}</p>
                  {ev.event_date && (
                    <p className="text-gray-500 text-xs">
                      {new Date(ev.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${
                  ev.status === 'completed' ? 'bg-green-900/50 text-green-400' :
                  ev.status === 'execution' ? 'bg-orange-900/50 text-orange-400' :
                  ev.status === 'active' ? 'bg-blue-900/50 text-blue-400' :
                  'bg-gray-800 text-gray-400'
                }`}>{ev.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Elements Assigned */}
      {(elements || []).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold">Items Delivered</h3>
            <p className="text-gray-500 text-xs mt-0.5">{totalItems} elements across all events</p>
          </div>
          <div className="divide-y divide-gray-800">
            {(elements as any[]).slice(0, 20).map(el => (
              <div key={el.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{el.name}</p>
                  <p className="text-gray-500 text-xs truncate">
                    {el.events?.name}
                    {el.size ? ` · ${el.size}` : ''}
                    {el.specs ? ` · ${el.specs}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-gray-300 text-sm">Qty: {el.quantity}</p>
                  {el.vendor_rate && (
                    <p className="text-gray-500 text-xs">{fmt(el.vendor_rate * el.quantity)}</p>
                  )}
                </div>
              </div>
            ))}
            {(elements || []).length > 20 && (
              <p className="text-gray-600 text-xs text-center py-3">+{(elements || []).length - 20} more items</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">{icon} {label}</div>
      <p className={`font-bold text-lg ${color}`}>{value}</p>
    </div>
  )
}
