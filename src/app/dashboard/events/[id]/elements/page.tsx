import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ElementSheet from './ElementSheet'

export default async function ElementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, status, poc_id')
    .eq('id', id)
    .single()

  if (!event) notFound()
  if (profile.role === 'poc' && event.poc_id !== user.id) redirect('/dashboard')

  const { data: elements } = await supabase
    .from('elements')
    .select('*, vendors(name)')
    .eq('event_id', id)
    .order('created_at')

  const { data: vendors } = profile.role === 'director'
    ? await supabase.from('vendors').select('id, name, category').order('name')
    : { data: [] }

  // Fetch event team members for assignment dropdown
  const { data: teamMembers } = await supabase
    .from('event_team')
    .select('id, role_in_event, department, freelancer_name, is_freelancer, member:profiles!event_team_user_id_fkey(id, name)')
    .eq('event_id', id)
    .order('created_at')

  const showCosts = ['director', 'accounts'].includes(profile.role)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-gray-500 text-sm">
          <a href={`/dashboard/events/${id}`} className="hover:text-white transition-colors">← {event.name}</a>
        </p>
        <h1 className="text-white text-2xl font-bold mt-1">Element Sheet</h1>
      </div>
      <ElementSheet
        eventId={id}
        elements={elements || []}
        vendors={vendors || []}
        teamMembers={(teamMembers || []) as any[]}
        userRole={profile.role}
        userId={user.id}
        showCosts={showCosts}
        isDirector={profile.role === 'director'}
      />
    </div>
  )
}
