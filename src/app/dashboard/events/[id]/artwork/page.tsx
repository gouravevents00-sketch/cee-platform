import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ArtworkView from './ArtworkView'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function ArtworkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: event } = await supabase.from('events').select('id, name, status').eq('id', id).single()
  if (!event) notFound()

  if (profile.role === 'poc') {
    const { data: ev } = await supabase.from('events').select('poc_id').eq('id', id).single()
    if (ev?.poc_id !== user.id) redirect('/dashboard')
  }
  if (profile.role === 'accounts') redirect('/dashboard')

  const [{ data: artworkTasks }, { data: designers }, { data: elements }] = await Promise.all([
    supabase.from('artwork_tasks')
      .select('*, assignee:profiles!artwork_tasks_assigned_to_fkey(id, name), element:elements!artwork_tasks_element_id_fkey(id, name)')
      .eq('event_id', id)
      .order('created_at'),
    supabase.from('profiles').select('id, name').eq('role', 'design').order('name'),
    supabase.from('elements').select('id, name').eq('event_id', id).neq('status', 'cancelled').order('name'),
  ])

  const canBrief = ['director', 'admin', 'poc'].includes(profile.role)
  const isDesign = profile.role === 'design'
  const canApprove = ['director', 'admin', 'poc'].includes(profile.role)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/dashboard/events/${id}`} className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-white text-xl font-bold">Artwork Tasks</h1>
          <p className="text-gray-500 text-xs mt-0.5">{event.name}</p>
        </div>
      </div>

      <ArtworkView
        eventId={id}
        artworkTasks={(artworkTasks || []) as any[]}
        designers={(designers || []) as any[]}
        elements={(elements || []) as any[]}
        canBrief={canBrief}
        isDesign={isDesign}
        canApprove={canApprove}
        currentUserId={user.id}
      />
    </div>
  )
}
