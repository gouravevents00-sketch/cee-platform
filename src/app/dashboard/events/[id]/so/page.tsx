import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import SOGenerator from './SOGenerator'

export default async function SOPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['director', 'accounts'].includes(profile.role)) redirect(`/dashboard/events/${id}`)

  const { data: event } = await supabase
    .from('events')
    .select('id, name, event_date, venue, city, clients(name)')
    .eq('id', id)
    .single() as any

  if (!event) notFound()

  const { data: elements } = await supabase
    .from('elements')
    .select('*, vendors(id, name, contact_name, contact_phone, category)')
    .eq('event_id', id)
    .neq('status', 'cancelled')
    .order('name')

  // Get unique vendors from elements
  const vendorMap: Record<string, any> = {}
  ;(elements || []).forEach(el => {
    if (el.vendor_id && el.vendors) {
      vendorMap[el.vendor_id] = el.vendors
    }
  })
  const vendors = Object.values(vendorMap)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 print:hidden">
        <p className="text-gray-500 text-sm">
          <a href={`/dashboard/events/${id}`} className="hover:text-white transition-colors">← {event.name}</a>
        </p>
        <h1 className="text-white text-2xl font-bold mt-1">Service Order</h1>
        <p className="text-gray-500 text-sm mt-0.5">Generate vendor SOs for this event</p>
      </div>
      <SOGenerator
        event={event}
        elements={elements || []}
        vendors={vendors}
      />
    </div>
  )
}
