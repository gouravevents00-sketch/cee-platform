import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import AIChatPanel from '@/components/AIChatPanel'
import { Profile } from '@/lib/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Sidebar profile={profile as Profile} />
      <main className="flex-1 md:ml-56 pt-16 md:pt-0 p-4 md:p-6 min-h-screen">
        {children}
      </main>
      <AIChatPanel userRole={profile.role} userName={profile.name}  />
    </div>
  )
}
