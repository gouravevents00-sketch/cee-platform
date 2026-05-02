import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeamManager from './TeamManager'
import TeamLoadView from './TeamLoadView'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'director') redirect('/dashboard')

  const [{ data: team }, { data: activeEvents }] = await Promise.all([
    supabase.from('profiles').select('*').order('role'),
    supabase.from('events')
      .select('id, name, event_date, status, poc_id, poc:profiles!events_poc_id_fkey(id, name, role)')
      .in('status', ['enquiry', 'active', 'execution'])
      .order('event_date', { ascending: true }),
  ])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Team</h1>
        <p className="text-gray-500 text-sm mt-0.5">{team?.length || 0} members</p>
      </div>

      {/* Team Load View */}
      <TeamLoadView team={team || []} activeEvents={(activeEvents || []) as any[]} />

      <div className="mt-8 mb-4">
        <h2 className="text-white font-semibold">Manage Team</h2>
      </div>
      <TeamManager team={team || []} currentUserId={user.id} />
    </div>
  )
}
