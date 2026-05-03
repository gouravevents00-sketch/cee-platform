import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import EventTeamView from './EventTeamView'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function EventTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: event } = await supabase.from('events').select('id, name, status, poc_id').eq('id', id).single()
  if (!event) notFound()

  if (profile.role === 'poc' && event.poc_id !== user.id) redirect('/dashboard')

  const [{ data: teamMembers }, { data: allProfiles }] = await Promise.all([
    supabase.from('event_team')
      .select('*, member:profiles!event_team_user_id_fkey(id, name, role)')
      .eq('event_id', id)
      .order('created_at'),
    supabase.from('profiles').select('id, name, role').order('name'),
  ])

  const canManage = ['director', 'admin'].includes(profile.role)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/dashboard/events/${id}`} className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-white text-xl font-bold">Event Team</h1>
          <p className="text-gray-500 text-xs mt-0.5">{event.name}</p>
        </div>
      </div>

      <EventTeamView
        eventId={id}
        teamMembers={(teamMembers || []) as any[]}
        allProfiles={(allProfiles || []) as any[]}
        canManage={canManage}
        currentUserId={user.id}
      />
    </div>
  )
}
