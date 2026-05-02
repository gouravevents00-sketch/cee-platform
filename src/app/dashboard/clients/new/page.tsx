import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewClientForm from './NewClientForm'

export default async function NewClientPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'director') redirect('/dashboard/clients')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">New Client</h1>
        <p className="text-gray-500 text-sm mt-0.5">Add client details and payment terms</p>
      </div>
      <NewClientForm />
    </div>
  )
}
