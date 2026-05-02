import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FollowUpDashboard from './FollowUpDashboard'

export default async function FollowUpPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['director', 'accounts'].includes(profile.role)) redirect('/dashboard')

  const { data: payments } = await supabase
    .from('payments')
    .select('*, events(id, name, clients(name, type, contact_name, contact_phone, credit_period_days))')
    .in('status', ['pending', 'overdue'])
    .order('due_date', { ascending: true })

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Payment Follow-Up</h1>
        <p className="text-gray-500 text-sm mt-0.5">Pending and overdue client payments across all events</p>
      </div>
      <FollowUpDashboard payments={payments || []} isDirector={profile.role === 'director'} />
    </div>
  )
}
