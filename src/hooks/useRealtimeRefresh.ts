'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// Refreshes the page whenever any of the given tables change for the given event
export function useRealtimeRefresh(tables: string[], eventId?: string) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const channels = tables.map(table => {
      const filter = eventId ? `event_id=eq.${eventId}` : undefined
      return supabase
        .channel(`realtime-${table}-${eventId || 'global'}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table,
          filter,
        }, () => {
          router.refresh()
        })
        .subscribe()
    })

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel))
    }
  }, [eventId])
}
