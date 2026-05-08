import { createServiceClient } from '@/lib/supabase/service'
import ClientQuoteView from './ClientQuoteView'

export default async function QuoteViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: tokenRow, error } = await supabase
    .from('quotation_tokens')
    .select('quotation_id, event_id, status, viewed_at, decided_at, client_decision, client_note, expires_at')
    .eq('token', token)
    .single()

  if (error || !tokenRow) {
    return <ErrorPage message="This quotation link is invalid or has been removed." />
  }

  const expires = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null
  if (expires && expires < new Date()) {
    return <ErrorPage message="This quotation link has expired. Please contact Creative Era Events for a new link." />
  }

  // Mark viewed
  if (!tokenRow.viewed_at) {
    await supabase.from('quotation_tokens').update({ viewed_at: new Date().toISOString() }).eq('token', token)
  }

  const { data: quot } = await supabase
    .from('quotations')
    .select('*, events(name, event_date, venue, city, clients(name, contact_name, contact_phone, contact_email))')
    .eq('id', tokenRow.quotation_id)
    .single()

  if (!quot) return <ErrorPage message="Quotation not found." />

  return (
    <ClientQuoteView
      token={token}
      quot={quot}
      alreadyDecided={['accepted', 'changes_requested'].includes(tokenRow.status)}
      clientDecision={tokenRow.client_decision}
      clientNote={tokenRow.client_note}
    />
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center mx-auto mb-4">
          <span className="text-sm font-black text-black">CE</span>
        </div>
        <p className="text-gray-400 text-sm">{message}</p>
        <p className="text-gray-600 text-xs mt-4">Creative Era Events · +91 86023 71023</p>
      </div>
    </div>
  )
}
