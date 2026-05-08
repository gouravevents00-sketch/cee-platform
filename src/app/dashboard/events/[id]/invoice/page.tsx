import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import InvoiceView from './InvoiceView'

const COMPANIES = {
  cee: {
    name: 'CREATIVE ERA EVENTS',
    tagline: 'Creating Experiences That Last Forever',
    contact: 'Indore, Madhya Pradesh · +91 86023 71023 · creativeeraevents@gmail.com',
    prefix: 'CEE',
    footer: 'Creative Era Events · creativeeraevents@gmail.com · Indore, MP',
  },
  cex: {
    name: 'CREATIVE ERA EXPERIENCES',
    tagline: 'Technology Meets Emotion',
    contact: 'Indore, Madhya Pradesh · +91 86023 71023 · info@cex.creativeera.in',
    prefix: 'CEX',
    footer: 'Creative Era Experiences · info@cex.creativeera.in · Indore, MP',
  },
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['director', 'accounts', 'admin'].includes(profile.role)) redirect('/dashboard')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, clients(name, contact_name, contact_phone, contact_email, client_type)')
    .eq('id', id)
    .single()

  if (!event) notFound()

  const client = (event as any).clients

  const [
    { data: invoice },
    { data: payments },
    { data: receipts },
    { data: quotation },
  ] = await Promise.all([
    supabase.from('client_invoices').select('*').eq('event_id', id)
      .order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('payments').select('id, type, label, amount, due_date, received_date, status')
      .eq('event_id', id).order('created_at'),
    supabase.from('client_receipts').select('*').eq('event_id', id).order('receipt_date'),
    supabase.from('quotations').select('company').eq('event_id', id)
      .order('created_at', { ascending: false }).limit(1).single(),
  ])

  const companyKey = (quotation?.company || 'cee') as 'cee' | 'cex'
  const company = COMPANIES[companyKey]
  const ev = event as any

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5 print:hidden">
        <Link href={`/dashboard/events/${id}`} className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} /> {ev.name}
        </Link>
        <h1 className="text-white text-2xl font-bold mt-1">Client Invoice</h1>
        {!invoice && (
          <p className="text-gray-500 text-sm mt-1">
            No invoice yet — lock the quotation to auto-generate one.
          </p>
        )}
      </div>

      {invoice ? (
        <InvoiceView
          eventId={id}
          eventName={ev.name}
          clientName={client?.name}
          clientContact={client?.contact_name}
          clientPhone={client?.contact_phone}
          clientEmail={client?.contact_email}
          clientType={client?.client_type}
          invoice={invoice}
          payments={payments || []}
          receipts={(receipts || []) as any[]}
          isDirector={profile.role === 'director'}
          canEdit={['director', 'accounts', 'admin'].includes(profile.role)}
          company={company}
        />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-400 text-sm">Lock the quotation first to auto-generate the invoice.</p>
          {(profile.role === 'director') && (
            <Link href={`/dashboard/events/${id}/quotation`}
              className="inline-block mt-3 text-amber-500 hover:text-amber-400 text-sm transition-colors">
              → Go to Quotation Builder
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
