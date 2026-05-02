'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Clock, ChevronDown } from 'lucide-react'

interface Approval {
  id: string
  type: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  comment?: string
  attachment_url?: string
  events?: { name: string; id: string }
  requester?: { name: string; role: string }
}

interface Props {
  approvals: Approval[]
  userId: string
}

export default function ApprovalsList({ approvals, userId }: Props) {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [comment, setComment] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const filtered = filter === 'all' ? approvals : approvals.filter(a => a.status === filter)

  async function decide(id: string, status: 'approved' | 'rejected') {
    setLoading(id)
    await supabase
      .from('approvals')
      .update({
        status,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        comment: comment[id] || null,
      })
      .eq('id', id)
    router.refresh()
    setLoading(null)
  }

  return (
    <div>
      {/* Filter Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 text-sm py-2 rounded-lg font-medium capitalize transition-colors ${
              filter === f ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Approvals List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No approvals found</p>
          </div>
        )}

        {filtered.map(approval => (
          <div
            key={approval.id}
            className={`bg-gray-900 border rounded-2xl p-5 ${
              approval.status === 'pending' ? 'border-amber-900/40' :
              approval.status === 'approved' ? 'border-green-900/40' :
              'border-red-900/40'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {approval.status === 'pending' ? (
                    <Clock size={15} className="text-amber-400" />
                  ) : approval.status === 'approved' ? (
                    <CheckCircle2 size={15} className="text-green-400" />
                  ) : (
                    <XCircle size={15} className="text-red-400" />
                  )}
                  <p className="text-white font-semibold text-sm">{approval.type}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    approval.status === 'pending' ? 'bg-amber-900/50 text-amber-400' :
                    approval.status === 'approved' ? 'bg-green-900/50 text-green-400' :
                    'bg-red-900/50 text-red-400'
                  }`}>
                    {approval.status}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {approval.events?.name} • Requested by {approval.requester?.name}
                </p>
                <p className="text-gray-600 text-xs">
                  {new Date(approval.requested_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {approval.attachment_url && (
                <a
                  href={approval.attachment_url}
                  target="_blank"
                  className="text-xs text-amber-500 hover:text-amber-400 flex-shrink-0"
                >
                  View Attachment
                </a>
              )}
            </div>

            {approval.comment && (
              <div className="bg-gray-800 rounded-xl px-3 py-2 mb-3">
                <p className="text-gray-400 text-xs">{approval.comment}</p>
              </div>
            )}

            {/* Action Buttons for pending */}
            {approval.status === 'pending' && (
              <div className="space-y-2">
                <textarea
                  value={comment[approval.id] || ''}
                  onChange={e => setComment(c => ({ ...c, [approval.id]: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 resize-none placeholder-gray-600"
                  placeholder="Comment (optional)..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => decide(approval.id, 'rejected')}
                    disabled={loading === approval.id}
                    className="flex-1 bg-red-950 hover:bg-red-900 text-red-400 font-medium px-3 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                  <button
                    onClick={() => decide(approval.id, 'approved')}
                    disabled={loading === approval.id}
                    className="flex-1 bg-green-950 hover:bg-green-900 text-green-400 font-medium px-3 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={14} /> Approve
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
