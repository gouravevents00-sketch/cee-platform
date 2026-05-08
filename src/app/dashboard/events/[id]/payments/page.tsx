import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import PaymentTracker from './PaymentTracker'

export default async function PaymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  if (!['director', 'accounts'].includes(profile.role)) redirect(`/dashboard/events/${id}`)

  const { data: event } = await supabase
    .from('events')
    .select('id, name, client_id, clients(name, type, advance_percent, credit_period_days)')
    .eq('id', id)
    .single() as any

  if (!event) notFound()

  const [{ data: payments }, { data: vendorPayments }, { data: vendors }] = await Promise.all([
    supabase.from('payments').select('*').eq('event_id', id).order('created_at'),
    supabase.from('vendor_payments').select('*, vendors(name, category)').eq('event_id', id).order('created_at'),
    supabase.from('vendors').select('id, name, category').order('name'),
  ])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <p className="text-gray-500 text-sm">
          <a href={`/dashboard/events/${id}`} className="hover:text-white transition-colors">← {event.name}</a>
        </p>
        <h1 className="text-white text-2xl font-bold mt-1">Payments</h1>
        {event.clients && (
          <p className="text-gray-500 text-sm mt-0.5">
            {event.clients.name} · {event.clients.advance_percent}% advance · {event.clients.credit_period_days} day credit
          </p>
        )}
      </div>
      <PaymentTracker
        eventId={id}
        payments={payments || []}
        vendorPayments={vendorPayments || []}
        vendors={vendors || []}
        isDirector={profile.role === 'director'}
        isAccounts={profile.role === 'accounts'}
      />
    </div>
  )
}
