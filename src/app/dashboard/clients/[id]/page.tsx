import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, Phone, Mail, CalendarDays, IndianRupee, TrendingUp, Clock } from 'lucide-react'
import DeleteClientButton from './DeleteClientButton'

const CLIENT_TYPE_COLORS: Record<string, string> = {
  agency: 'bg-blue-900/50 text-blue-400',
  corporate: 'bg-purple-900/50 text-purple-400',
  government: 'bg-green-900/50 text-green-400',
  individual: 'bg-gray-800 text-gray-400',
}

const STATUS_COLORS: Record<string, string> = {
  enquiry: 'bg-gray-800 text-gray-400',
  active: 'bg-blue-900/50 text-blue-400',
  execution: 'bg-orange-900/50 text-orange-400',
  completed: 'bg-green-900/50 text-green-400',
  cancelled: 'bg-red-900/50 text-red-400',
}

export default async function ClientCRMPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['director', 'accounts', 'admin'].includes(profile.role)) redirect('/dashboard')

  const { data: client } = await supabase.from('clients').select('*').eq('id', id).single()
  if (!client) notFound()

  // All events for this client
  const { data: events } = await supabase
    .from('events')
    .select('id, name, event_date, status, venue, city, type, current_phase')
    .eq('client_id', id)
    .order('event_date', { ascending: false })

  // All payments for this client's events
  const eventIds = (events || []).map(e => e.id)
  const { data: payments } = eventIds.length > 0
    ? await supabase.from('payments').select('*').in('event_id', eventIds)
    : { data: [] }

  // Per-event payment map
  const paymentsByEvent: Record<string, { expected: number; received: number }> = {}
  ;(payments || []).forEach(p => {
    if (!paymentsByEvent[p.event_id]) paymentsByEvent[p.event_id] = { expected: 0, received: 0 }
    paymentsByEvent[p.event_id].expected += p.amount
    if (p.status === 'received') paymentsByEvent[p.event_id].received += p.amount
  })

  // Aggregates
  const totalEvents = (events || []).length
  const completedEvents = (events || []).filter(e => e.status === 'completed').length
  const activeEvents = (events || []).filter(e => ['active', 'execution'].includes(e.status)).length
  const totalRevenue = (payments || []).reduce((s, p) => s + p.amount, 0)
  const totalReceived = (payments || []).filter(p => p.status === 'received').reduce((s, p) => s + p.amount, 0)
  const totalOutstanding = totalRevenue - totalReceived
  const lastEvent = (events || []).find(e => e.status === 'completed' || e.event_date)

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back */}
      <div className="mb-5">
        <Link href="/dashboard/clients" className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} /> Clients
        </Link>
      </div>

      {/* Client Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center flex-shrink-0">
              <Building2 size={22} className="text-gray-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-white text-xl font-bold">{client.name}</h1>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${CLIENT_TYPE_COLORS[client.type]}`}>
                  {client.type}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                {client.contact_name && (
                  <span className="flex items-center gap-1.5">{client.contact_name}</span>
                )}
                {client.contact_phone && (
                  <span className="flex items-center gap-1.5"><Phone size={12} /> {client.contact_phone}</span>
                )}
                {client.contact_email && (
                  <span className="flex items-center gap-1.5"><Mail size={12} /> {client.contact_email}</span>
                )}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span>{client.advance_percent}% advance required</span>
                <span>{client.credit_period_days} day credit period</span>
                {client.work_order_number && <span>WO#: {client.work_order_number}</span>}
              </div>
              {client.notes && <p className="text-gray-600 text-xs mt-2 italic">{client.notes}</p>}
            </div>
          </div>
          {profile.role === 'director' && (
            <div className="flex-shrink-0">
              <DeleteClientButton clientId={id} />
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Events" value={totalEvents.toString()} icon={<CalendarDays size={14} />} color="text-white" />
        <StatCard label="Completed" value={completedEvents.toString()} icon={<TrendingUp size={14} />} color="text-green-400" />
        <StatCard label="Total Billed" value={fmt(totalRevenue)} icon={<IndianRupee size={14} />} color="text-white" />
        <StatCard
          label="Outstanding"
          value={fmt(totalOutstanding)}
          icon={<Clock size={14} />}
          color={totalOutstanding > 0 ? 'text-amber-400' : 'text-green-400'}
        />
      </div>

      {/* Payment Health */}
      {totalRevenue > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
          <h3 className="text-white font-semibold text-sm mb-3">Payment Health</h3>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>₹{totalReceived.toLocaleString('en-IN')} collected of ₹{totalRevenue.toLocaleString('en-IN')}</span>
            <span>{totalRevenue > 0 ? Math.round((totalReceived / totalRevenue) * 100) : 0}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${totalRevenue > 0 ? (totalReceived / totalRevenue) * 100 : 0}%` }}
            />
          </div>
          {totalOutstanding > 0 && (
            <p className="text-amber-400 text-xs mt-2">⚠ {fmt(totalOutstanding)} outstanding across all events</p>
          )}
        </div>
      )}

      {/* Event History */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">Event History</h3>
            <p className="text-gray-500 text-xs mt-0.5">{totalEvents} events · {activeEvents} active</p>
          </div>
        </div>

        {(events || []).length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-600">No events for this client yet</p>
            <Link href="/dashboard/events/new" className="text-amber-500 text-sm mt-2 inline-block hover:text-amber-400">
              + Create first event
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {(events as any[]).map(ev => {
              const epmt = paymentsByEvent[ev.id] || { expected: 0, received: 0 }
              const pct = epmt.expected > 0 ? Math.round((epmt.received / epmt.expected) * 100) : 0
              return (
                <Link
                  key={ev.id}
                  href={`/dashboard/events/${ev.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-800/40 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-white font-medium group-hover:text-amber-400 transition-colors truncate">
                        {ev.name}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${STATUS_COLORS[ev.status]}`}>
                        {ev.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      {ev.event_date && (
                        <span className="flex items-center gap-1">
                          <CalendarDays size={10} />
                          {new Date(ev.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      {ev.venue && <span>{ev.venue}{ev.city ? `, ${ev.city}` : ''}</span>}
                      {ev.type && <span className="capitalize">{ev.type}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {epmt.expected > 0 ? (
                      <>
                        <p className="text-white text-sm font-semibold">{fmt(epmt.expected)}</p>
                        <p className={`text-xs ${pct === 100 ? 'text-green-400' : 'text-amber-400'}`}>
                          {pct}% collected
                        </p>
                      </>
                    ) : (
                      <p className="text-gray-600 text-xs">No payments</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
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
