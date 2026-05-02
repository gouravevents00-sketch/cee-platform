'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock } from 'lucide-react'

interface Props {
  paymentId: string
  vendorName: string
  category?: string
  amount: number
  status: string
  paidDate?: string
  canEdit: boolean
}

export default function VendorPaymentRow({ paymentId, vendorName, category, amount, status, paidDate, canEdit }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function markPaid() {
    setLoading(true)
    await fetch(`/api/vendor-payments/${paymentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] }),
    })
    router.refresh()
    setLoading(false)
  }

  async function markPending() {
    setLoading(true)
    await fetch(`/api/vendor-payments/${paymentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending', paid_date: null }),
    })
    router.refresh()
    setLoading(false)
  }

  const statusColor =
    status === 'paid' ? 'text-green-400' :
    status === 'overdue' ? 'text-red-400' :
    'text-amber-400'

  return (
    <div className="flex items-center justify-between py-2 gap-3">
      <div className="flex-1 min-w-0">
        <span className="text-gray-300 text-sm">
          {vendorName}{category ? ` (${category})` : ''}
        </span>
        {paidDate && status === 'paid' && (
          <span className="text-gray-600 text-xs ml-2">
            paid {new Date(paidDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-sm font-semibold ${statusColor}`}>
          ₹{amount.toLocaleString('en-IN')}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
          status === 'paid' ? 'bg-green-900/40 text-green-400' :
          status === 'overdue' ? 'bg-red-900/40 text-red-400' :
          'bg-amber-900/40 text-amber-400'
        }`}>{status}</span>
        {canEdit && (
          status === 'paid' ? (
            <button
              onClick={markPending}
              disabled={loading}
              className="text-xs text-gray-600 hover:text-gray-400 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              <Clock size={11} /> Undo
            </button>
          ) : (
            <button
              onClick={markPaid}
              disabled={loading}
              className="text-xs bg-green-900/40 border border-green-800/50 text-green-400 hover:bg-green-900/60 px-2 py-1 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              <CheckCircle2 size={11} /> {loading ? '...' : 'Mark Paid'}
            </button>
          )
        )}
      </div>
    </div>
  )
}
