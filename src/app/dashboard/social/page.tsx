import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SocialCalendar from './SocialCalendar'

export default async function SocialPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['director', 'admin', 'design'].includes(profile.role)) redirect('/dashboard')

  const [{ data: posts }, { data: events }] = await Promise.all([
    supabase.from('social_posts')
      .select('*, events(name), creator:profiles!social_posts_created_by_fkey(name)')
      .order('scheduled_date', { ascending: true }),
    supabase.from('events').select('id, name').neq('status', 'cancelled').order('name'),
  ])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Social Media</h1>
        <p className="text-gray-500 text-sm mt-0.5">Content calendar for CEE · Instagram, YouTube, WhatsApp</p>
      </div>
      <SocialCalendar
        posts={posts || []}
        events={events || []}
        userId={user.id}
        userRole={profile.role}
        isDirector={profile.role === 'director'}
      />
    </div>
  )
}
