'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_TRANSITIONS: Record<string, string[]> = {
  inquiry: ['confirmed', 'cancelled'],
  confirmed: ['assigned', 'cancelled'],
  assigned: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

interface Props {
  orderId: string
  currentStatus: string
  currentOperatorId: string | null
  operators: { id: string; name: string; role: string }[]
  isDirector: boolean
}

export default function OrderActions({ orderId, currentStatus, currentOperatorId, operators, isDirector }: Props) {
  const router = useRouter()
  const [operatorId, setOperatorId] = useState(currentOperatorId || '')
  const [loading, setLoading] = useState('')

  const nextStatuses = STATUS_TRANSITIONS[currentStatus] || []

  async function updateOrder(body: object) {
    const res = await fetch(`/api/experiences/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) router.refresh()
  }

  async function handleStatusChange(status: string) {
    setLoading(status)
    await updateOrder({ status })
    setLoading('')
  }

  async function handleAssignOperator() {
    if (!operatorId) return
    setLoading('operator')
    const update: Record<string, string> = { operator_id: operatorId }
    if (currentStatus === 'confirmed') update.status = 'assigned'
    await updateOrder(update)
    setLoading('')
  }

  return (
    <div className="space-y-3 pb-6">
      {isDirector && currentStatus !== 'completed' && currentStatus !== 'cancelled' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Assign Operator</h2>
          <div className="flex gap-3">
            <select
              value={operatorId}
              onChange={e => setOperatorId(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="">Select operator...</option>
              {operators.map(op => (
                <option key={op.id} value={op.id}>{op.name} ({op.role})</option>
              ))}
            </select>
            <button
              onClick={handleAssignOperator}
              disabled={!operatorId || loading === 'operator'}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              {loading === 'operator' ? 'Saving...' : 'Assign'}
            </button>
          </div>
        </div>
      )}

      {nextStatuses.length > 0 && (
        <div className="flex gap-3">
          {nextStatuses.map(status => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              disabled={!!loading}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                status === 'cancelled'
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  : 'bg-amber-500 hover:bg-amber-400 text-black'
              }`}
            >
              {loading === status ? 'Updating...' : `Mark as ${status.charAt(0).toUpperCase() + status.slice(1)}`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
