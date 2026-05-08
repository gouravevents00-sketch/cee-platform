import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import BoothOperator from './BoothOperator'

export default async function BoothOperatorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const canAccess = profile.role === 'director' || profile.role === 'admin' || profile.role === 'poc'
  if (!canAccess) redirect('/dashboard/experiences')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/experiences"
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          <ChevronLeft size={16} />
          Experiences
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-white font-semibold">AI Photo Booth — Operator</h1>
      </div>

      <BoothOperator />
    </div>
  )
}
