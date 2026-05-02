import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ExpensesList from './ExpensesList'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const isDirector = profile.role === 'director'
  const isAccounts = profile.role === 'accounts'
  const isPOC = profile.role === 'poc'

  if (!isDirector && !isAccounts && !isPOC) redirect('/dashboard')

  // POC only sees their own expenses; directors/accounts see all
  let query = supabase
    .from('expenses')
    .select('*, events(name, id), submitter:profiles!expenses_submitted_by_fkey(name, role)')
    .order('submitted_at', { ascending: false })

  if (isPOC) query = query.eq('submitted_by', user.id)

  const { data: expenses } = await query

  // Get events for POC to submit expense
  let events: any[] = []
  if (isPOC) {
    const { data } = await supabase.from('events').select('id, name').eq('poc_id', user.id).neq('status', 'completed')
    events = data || []
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Expenses</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {expenses?.filter(e => e.status === 'pending').length || 0} pending review
        </p>
      </div>
      <ExpensesList
        expenses={expenses || []}
        userId={user.id}
        userRole={profile.role}
        events={events}
        isDirector={isDirector || isAccounts}
      />
    </div>
  )
}
