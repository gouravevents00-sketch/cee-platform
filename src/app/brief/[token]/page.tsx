import { createServiceClient } from '@/lib/supabase/service'
import BriefForm from './BriefForm'

export default async function BriefFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('brief_tokens')
    .select('id, client_name, client_phone, client_email, prefilled_event_type, prefilled_date, prefilled_city, status, expires_at')
    .eq('token', token)
    .single()

  if (error || !data) {
    return <ErrorPage message="This form link is invalid or has been removed." />
  }

  const expires = data.expires_at ? new Date(data.expires_at) : null
  if (expires && expires < new Date()) {
    return <ErrorPage message="This form link has expired. Please contact Creative Era Events for a new link." />
  }

  if (data.status === 'filled') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-900/50 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✓</span>
          </div>
          <h1 className="text-white text-xl font-bold mb-2">Brief Already Submitted</h1>
          <p className="text-gray-400 text-sm">Your event brief has been received. Our team will review it and get back to you shortly.</p>
          <p className="text-gray-600 text-xs mt-4">Creative Era Events · +91 86023 71023</p>
        </div>
      </div>
    )
  }

  return (
    <BriefForm
      token={token}
      prefill={{
        clientName: data.client_name || '',
        clientPhone: data.client_phone || '',
        clientEmail: data.client_email || '',
        eventType: data.prefilled_event_type || '',
        eventDate: data.prefilled_date || '',
        city: data.prefilled_city || '',
      }}
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
