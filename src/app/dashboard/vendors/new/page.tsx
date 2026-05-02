import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewVendorForm from './NewVendorForm'

export default async function NewVendorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'director') redirect('/dashboard/vendors')

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">New Vendor</h1>
        <p className="text-gray-500 text-sm mt-0.5">Add vendor details and reliability rating</p>
      </div>
      <NewVendorForm />
    </div>
  )
}
