import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import ActivationManager from './ActivationManager'

export default async function BrandActivationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['director', 'admin'].includes(profile.role)) redirect('/dashboard/experiences')

  const svc = createServiceClient()
  const { data: configs } = await svc
    .from('brand_activation_configs')
    .select('*')
    .order('sort_order', { ascending: true })

  return <ActivationManager initialConfigs={configs ?? []} />
}
