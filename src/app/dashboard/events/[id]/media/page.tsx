import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import MediaView from './MediaView'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function EventMediaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: event } = await supabase.from('events').select('id, name, status, poc_id').eq('id', id).single()
  if (!event) notFound()

  if (profile.role === 'poc' && event.poc_id !== user.id) redirect('/dashboard')
  if (profile.role === 'accounts') redirect('/dashboard')

  const [{ data: mediaItems }, { data: elements }] = await Promise.all([
    supabase
      .from('event_media')
      .select('*, uploader:profiles!event_media_uploaded_by_fkey(id, name, role)')
      .eq('event_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('elements')
      .select('id, name')
      .eq('event_id', id)
      .neq('status', 'cancelled')
      .order('name'),
  ])

  const canUpload = ['director', 'admin', 'poc'].includes(profile.role)
  const canApprove = ['director', 'admin', 'design'].includes(profile.role)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/dashboard/events/${id}`} className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-white text-xl font-bold">Event Media</h1>
          <p className="text-gray-500 text-xs mt-0.5">{event.name} · On-ground photos & videos</p>
        </div>
      </div>

      <MediaView
        eventId={id}
        mediaItems={(mediaItems || []) as any[]}
        elements={(elements || []) as { id: string; name: string }[]}
        canUpload={canUpload}
        canApprove={canApprove}
        currentUserId={user.id}
        userRole={profile.role}
      />
    </div>
  )
}
