import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import MosaicManager from './MosaicManager'

export default async function MosaicWallPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['director', 'admin'].includes(profile.role)) redirect('/dashboard/experiences')

  const svc = createServiceClient()
  const { data: sessions } = await svc
    .from('mosaic_sessions')
    .select('*')
    .order('created_at', { ascending: false })

  return <MosaicManager initialSessions={sessions ?? []} />
}
