import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeaderboardView from './LeaderboardView'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  // Get all team members (non-directors) for director bonus UI
  const { data: team } = await supabase
    .from('profiles')
    .select('id, name, role')
    .neq('role', 'director')
    .order('name')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">CEEstar</h1>
        <p className="text-gray-500 text-sm mt-0.5">Top performers this month — recognition for the best Ceeians</p>
      </div>
      <LeaderboardView
        currentUserId={user.id}
        isDirector={profile.role === 'director'}
        team={team || []}
      />
    </div>
  )
}
