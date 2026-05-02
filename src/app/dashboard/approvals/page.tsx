import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ApprovalsList from './ApprovalsList'

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'director') redirect('/dashboard')

  const { data: approvals } = await supabase
    .from('approvals')
    .select('*, events(name, id), requester:profiles!approvals_requested_by_fkey(name, role)')
    .order('requested_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Approvals</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {approvals?.filter(a => a.status === 'pending').length || 0} pending approvals
        </p>
      </div>
      <ApprovalsList approvals={approvals || []} userId={user.id} />
    </div>
  )
}
