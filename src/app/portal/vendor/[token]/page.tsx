import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import VendorPortalView from './VendorPortalView'

export default async function VendorPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data: portalToken } = await supabase
    .from('portal_tokens')
    .select('*, events(id, name, event_date, venue, city, clients(name)), vendors(id, name, contact_name, category)')
    .eq('token', token)
    .eq('type', 'vendor')
    .gt('expires_at', new Date().toISOString())
    .single() as any

  if (!portalToken) notFound()

  const eventId = portalToken.event_id
  const vendorId = portalToken.vendor_id

  // Security: verify vendor still has active assignments in this event
  const { count: activeCount } = await supabase
    .from('elements')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .neq('status', 'cancelled')

  if (!activeCount || activeCount === 0) notFound()

  const [{ data: elements }, { data: payment }] = await Promise.all([
    supabase.from('elements')
      .select('id, name, specs, size, quantity, material, vendor_rate, notes')
      .eq('event_id', eventId)
      .eq('vendor_id', vendorId)
      .neq('status', 'cancelled')
      .order('name'),
    supabase.from('vendor_payments')
      .select('id, amount, status, due_date, paid_date, notes')
      .eq('event_id', eventId)
      .eq('vendor_id', vendorId)
      .maybeSingle(),
  ])

  return (
    <VendorPortalView
      event={portalToken.events}
      vendor={portalToken.vendors}
      elements={elements || []}
      payment={payment}
      token={token}
    />
  )
}
