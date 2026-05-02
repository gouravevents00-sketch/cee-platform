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
  if (!profile || !['director', 'accounts'].includes(profile.role)) redirect('/dashboard')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, clients(name, contact_name, contact_phone, contact_email)')
    .eq('id', id)
    .single()

  if (!event) notFound()

  const { data: quotation } = await supabase
    .from('quotations')
    .select('*')
    .eq('event_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const client = (event as any).clients

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-5 print:hidden">
        <Link href={`/dashboard/events/${id}`} className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm transition-colors">
          <ArrowLeft size={14} /> {(event as any).name}
        </Link>
        <h1 className="text-white text-2xl font-bold mt-1">Quotation Builder</h1>
      </div>
      <QuotationBuilder
        eventId={id}
        eventName={(event as any).name}
        clientName={client?.name}
        clientContact={client?.contact_name || client?.contact_phone || client?.contact_email}
        existingQuotation={quotation || null}
      />
    </div>
  )
}
