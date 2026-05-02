import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewEventForm from './NewEventForm'

export default async function NewEventPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'director') redirect('/dashboard')

  const [{ data: clients }, { data: pocs }, { data: templates }] = await Promise.all([
    supabase.from('clients').select('id, name, type').order('name'),
    supabase.from('profiles').select('id, name, role').in('role', ['poc', 'admin', 'director']).order('name'),
    supabase.from('event_templates').select('*').order('created_at', { ascending: false }),
  ])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">New Event</h1>
        <p className="text-gray-500 text-sm mt-0.5">Fill in the event details — all phases and tasks will be set up automatically</p>
      </div>
      <NewEventForm clients={clients || []} pocs={pocs || []} templates={templates || []} />
    </div>
  )
}
