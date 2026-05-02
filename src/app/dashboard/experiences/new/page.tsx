import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import NewOrderForm from './NewOrderForm'

export default async function NewExperienceOrderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  if (profile.role !== 'director' && profile.role !== 'admin') redirect('/dashboard/experiences')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/experiences" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-white text-2xl font-bold">New Booking</h1>
          <p className="text-gray-500 text-sm mt-0.5">Creative Era Experiences</p>
        </div>
      </div>
      <NewOrderForm userId={user.id} />
    </div>
  )
}
