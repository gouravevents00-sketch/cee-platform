'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ChevronDown, CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react'

const STATUSES = ['enquiry', 'active', 'execution', 'completed', 'cancelled'] as const
type Status = typeof STATUSES[number]

const STATUS_LABELS: Record<Status, string> = {
  enquiry: 'Enquiry',
  active: 'Active',
  execution: 'Execution',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<Status, string> = {
  enquiry: 'text-gray-400',
  active: 'text-blue-400',
  execution: 'text-orange-400',
  completed: 'text-green-400',
  cancelled: 'text-red-400',
}

interface CheckItem {
  id: string
  label: string
  passed: boolean
  detail: string
  blocking?: boolean
  outstandingAmount?: number
  vendorDueAmount?: number
  pendingItems?: string[]
}

export default function EventStatusUpdate({ eventId, currentStatus }: { eventId: string, currentStatus: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  const [checklist, setChecklist] = useState<{ checks: CheckItem[]; allClear: boolean; hasBlockers: boolean } | null>(null)
  const [checklistLoading, setChecklistLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleStatusClick(status: Status) {
    setOpen(false)
    if (status === 'completed') {
      setChecklistLoading(true)
      setShowChecklist(true)
      const res = await fetch(`/api/events/${eventId}/checklist`)
      const data = await res.json()
      setChecklist(data)
      setChecklistLoading(false)
    } else {
      await applyStatus(status)
    }
  }

  async function applyStatus(status: Status) {
    setLoading(true)
    setShowChecklist(false)
    await supabase.from('events').update({ status }).eq('id', eventId)
    await supabase.from('activity_log').insert({
      event_id: eventId,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      action: 'Status Updated',
      detail: `Event status changed to ${STATUS_LABELS[status]}`,
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          disabled={loading}
          className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          Update Status <ChevronDown size={12} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden z-20 min-w-[140px] shadow-xl">
              {STATUSES.map(status => (
                <button
                  key={status}
                  onClick={() => handleStatusClick(status)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                    status === currentStatus ? 'bg-gray-700/50' : ''
                  } ${STATUS_COLORS[status]}`}
                >
                  {status === currentStatus && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Closure Checklist Modal */}
      {showChecklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70" onClick={() => setShowChecklist(false)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white font-bold text-lg">Event Closure Checklist</h3>
                <p className="text-gray-500 text-xs mt-0.5">Review before marking as completed</p>
              </div>
              <button onClick={() => setShowChecklist(false)} className="text-gray-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {checklistLoading ? (
              <div className="py-8 text-center text-gray-500 text-sm">Checking event status...</div>
            ) : checklist ? (
              <>
                <div className="space-y-3 mb-6">
                  {checklist.checks.map(check => (
                    <div
                      key={check.id}
                      className={`flex items-start gap-3 p-3 rounded-xl ${
                        check.passed ? 'bg-green-950/30 border border-green-900/30' :
                        check.blocking ? 'bg-red-950/30 border border-red-900/40' :
                        'bg-gray-800 border border-gray-700'
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {check.passed
                          ? <CheckCircle2 size={16} className="text-green-400" />
                          : check.blocking
                          ? <XCircle size={16} className="text-red-400" />
                          : <AlertTriangle size={16} className="text-amber-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${check.passed ? 'text-green-400' : check.blocking ? 'text-red-400' : 'text-amber-400'}`}>
                          {check.label}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">{check.detail}</p>
                        {!check.passed && check.outstandingAmount && check.outstandingAmount > 0 && (
                          <p className="text-red-400 text-xs mt-0.5">₹{check.outstandingAmount.toLocaleString('en-IN')} outstanding</p>
                        )}
                        {!check.passed && check.vendorDueAmount && check.vendorDueAmount > 0 && (
                          <p className="text-amber-400 text-xs mt-0.5">₹{check.vendorDueAmount.toLocaleString('en-IN')} due to vendors</p>
                        )}
                        {!check.passed && check.pendingItems && check.pendingItems.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {check.pendingItems.map((item, i) => (
                              <li key={i} className="text-gray-600 text-xs">· {item}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {checklist.allClear ? (
                  <div className="space-y-3">
                    <p className="text-green-400 text-sm text-center font-medium">✓ All checks passed — ready to close!</p>
                    <button
                      onClick={() => applyStatus('completed')}
                      disabled={loading}
                      className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Marking Complete...' : 'Mark as Completed'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {checklist.hasBlockers && (
                      <p className="text-red-400 text-xs text-center">Some items need attention before closing</p>
                    )}
                    {!checklist.hasBlockers && (
                      <p className="text-amber-400 text-xs text-center">Some items are incomplete — you can still close if needed</p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setShowChecklist(false)}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-xl text-sm transition-colors"
                      >
                        Go Back & Fix
                      </button>
                      <button
                        onClick={() => applyStatus('completed')}
                        disabled={loading}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
                      >
                        {loading ? '...' : 'Close Anyway'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}
