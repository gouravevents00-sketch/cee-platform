import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ClientPortalView from './ClientPortalView'

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  // Validate token
  const { data: portalToken } = await supabase
    .from('portal_tokens')
    .select('*, events(*, clients(*))')
    .eq('token', token)
    .eq('type', 'client')
    .gt('expires_at', new Date().toISOString())
    .single() as any

  if (!portalToken) notFound()

  const event = portalToken.events
  const eventId = event.id

  const [
    { data: elements },
    { data: payments },
    { data: approvals },
  ] = await Promise.all([
    supabase.from('elements')
      .select('id, name, specs, size, quantity, material, status, vendors(name)')
      .eq('event_id', eventId)
      .neq('status', 'cancelled')
      .order('name'),
    supabase.from('payments')
      .select('id, type, amount, due_date, received_date, status')
      .eq('event_id', eventId)
      .order('created_at'),
    supabase.from('approvals')
      .select('id, type, status, attachment_url, comment, requested_at')
      .eq('event_id', eventId)
      .in('type', ['Layout Mockup Approval', 'Artwork / Creative Approval', 'Print Approval'])
      .order('requested_at', { ascending: false }),
  ])

  return (
    <ClientPortalView
      event={event}
      elements={elements || []}
      payments={payments || []}
      approvals={approvals || []}
      token={token}
    />
  )
}
