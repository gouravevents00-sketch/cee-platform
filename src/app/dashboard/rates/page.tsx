import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RatesMaster from './RatesMaster'

export default async function RatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['director', 'accounts'].includes(profile.role)) redirect('/dashboard')

  const { data: rates } = await supabase
    .from('rate_master')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('item_name')

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Rate Master</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Your base costs and selling rates — AI uses these to auto-fill quotations
        </p>
      </div>
      <RatesMaster initialRates={rates || []} />
    </div>
  )
}
