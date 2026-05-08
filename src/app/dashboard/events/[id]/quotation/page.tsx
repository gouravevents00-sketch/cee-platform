import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import QuotationBuilder from './QuotationBuilder'
import { ArrowLeft } from 'lucide-react'

export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['director', 'accounts', 'admin'].includes(profile.role)) redirect('/dashboard')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, type, city, event_date, clients(name, contact_name, contact_phone, contact_email)')
    .eq('id', id)
    .single()

  if (!event) notFound()

  const [
    { data: quotation },
    { data: elements },
    { data: vendors },
  ] = await Promise.all([
    supabase.from('quotations').select('*').eq('event_id', id)
      .order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('elements').select('name, specs, size, quantity, client_rate, vendor_rate, vendor_id, material')
      .eq('event_id', id).neq('status', 'cancelled').order('created_at'),
    supabase.from('vendors').select('id, name, category').order('name'),
  ])

  // Fetch client's latest token decision for this quotation
  const { data: tokenRow } = quotation?.id
    ? await supabase
        .from('quotation_tokens')
        .select('status, client_decision, client_note, decided_at')
        .eq('quotation_id', quotation.id)
        .not('client_decision', 'is', null)
        .order('decided_at', { ascending: false })
        .limit(1)
        .single()
    : { data: null }

  const clientTokenStatus = tokenRow ? {
    status: tokenRow.status,
    clientDecision: tokenRow.client_decision,
    clientNote: tokenRow.client_note,
    decidedAt: tokenRow.decided_at,
  } : undefined

  const client = (event as any).clients
  const ev = event as any

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5 print:hidden">
        <Link href={`/dashboard/events/${id}`} className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} /> {ev.name}
        </Link>
        <h1 className="text-white text-2xl font-bold mt-1">Quotation Builder</h1>
      </div>
      <QuotationBuilder
        eventId={id}
        eventName={ev.name}
        eventType={ev.type}
        eventCity={ev.city}
        eventDate={ev.event_date}
        clientName={client?.name}
        clientContact={client?.contact_name}
        clientPhone={client?.contact_phone}
        clientEmail={client?.contact_email}
        existingQuotation={quotation || null}
        eventElements={(elements || []) as any[]}
        vendors={(vendors || []) as { id: string; name: string; category?: string }[]}
        userRole={profile.role}
        clientTokenStatus={clientTokenStatus}
      />
    </div>
  )
}
