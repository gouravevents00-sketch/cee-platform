import { createClient } from '@/lib/supabase/server'
import { Clock } from 'lucide-react'

export default async function ActivityLog({ eventId }: { eventId: string }) {
  const supabase = await createClient()

  const { data: logs } = await supabase
    .from('activity_log')
    .select('*, user:profiles!activity_log_user_id_fkey(name, role)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!logs || logs.length === 0) return null

  return (
    <div className="mt-5">
      <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
        <Clock size={15} className="text-gray-500" /> Activity Log
      </h2>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800">
        {logs.map((log: any) => (
          <div key={log.id} className="px-4 py-3 flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs text-gray-400 font-medium">
                {log.user?.name?.charAt(0) || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white text-sm font-medium">{log.action}</span>
                {log.user?.name && (
                  <span className="text-gray-500 text-xs">by {log.user.name}</span>
                )}
              </div>
              {log.detail && <p className="text-gray-500 text-xs mt-0.5">{log.detail}</p>}
              <p className="text-gray-700 text-xs mt-0.5">
                {new Date(log.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
