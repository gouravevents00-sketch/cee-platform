import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CalendarView from './CalendarView'
import { CalendarDays } from 'lucide-react'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const query = supabase
    .from('events')
    .select('id, name, event_date, status, city, clients(name)')
    .not('event_date', 'is', null)
    .neq('status', 'cancelled')
    .order('event_date')

  const { data: events } = await query

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <CalendarDays size={18} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-white text-xl font-bold">Event Calendar</h1>
          <p className="text-gray-500 text-xs mt-0.5">All events by date</p>
        </div>
      </div>
      <CalendarView events={(events || []) as any[]} />
    </div>
  )
}
