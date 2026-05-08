import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import FilterManager from './FilterManager'

export default async function BoothFiltersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['director', 'admin'].includes(profile.role)) redirect('/dashboard/experiences/booth')

  const svc = createServiceClient()
  const { data: filters } = await svc
    .from('booth_filters')
    .select('*')
    .order('sort_order', { ascending: true })

  return <FilterManager initialFilters={filters ?? []} />
}
