import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MyTasksView from './MyTasksView'

export default async function MyTasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  // Directors have approvals page — redirect them
  if (profile.role === 'director') redirect('/dashboard/approvals')

  // Fetch all tasks for this role across all active events
  // POC: tasks from their assigned events only; others: all events by role
  let query = supabase
    .from('event_tasks')
    .select(`
      id, task_name, task_number, task_type, phase, phase_name,
      status, notes, completed_at,
      events!inner(id, name, event_date, status, current_phase, poc_id, clients(name))
    `)
    .order('phase')
    .order('task_number')

  if (profile.role === 'poc') {
    // POC sees their tasks from assigned events
    query = query.eq('owner_role', 'poc')
  } else {
    query = query.eq('owner_role', profile.role)
  }

  const { data: allTasks } = await query

  // Filter out tasks from completed/cancelled events
  const tasks = (allTasks || []).filter((t: any) =>
    !['completed', 'cancelled'].includes(t.events?.status) &&
    // POC: only their events
    (profile.role !== 'poc' || t.events?.poc_id === user.id)
  )

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">My Tasks</h1>
        <p className="text-gray-500 text-sm mt-0.5">Your assigned tasks across all active events</p>
      </div>
      <MyTasksView tasks={tasks as any[]} userId={user.id} userRole={profile.role} />
    </div>
  )
}
