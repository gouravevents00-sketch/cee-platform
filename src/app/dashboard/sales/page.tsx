import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeadPipeline from './LeadPipeline'

export default async function SalesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  // Sales visible to director and admin only
  if (!['director', 'admin'].includes(profile.role)) redirect('/dashboard')

  const [{ data: leads }, { data: profiles }, { data: clients }] = await Promise.all([
    supabase.from('leads')
      .select('*, assignee:profiles!leads_assigned_to_fkey(id, name), client:clients!leads_client_id_fkey(id, name)')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, name, role').order('name'),
    supabase.from('clients').select('id, name').order('name'),
  ])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Sales Pipeline</h1>
        <p className="text-gray-500 text-sm mt-0.5">{leads?.length || 0} leads · Track from first contact to closed deal</p>
      </div>
      <LeadPipeline
        leads={(leads || []) as any[]}
        profiles={(profiles || []) as any[]}
        clients={(clients || []) as any[]}
        userId={user.id}
        isDirector={profile.role === 'director'}
      />
    </div>
  )
}
