'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Plus, Receipt } from 'lucide-react'

interface Expense {
  id: string
  event_id: string
  item: string
  amount: number
  category: string
  bill_url?: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  events?: { name: string; id: string }
  submitter?: { name: string }
}

interface Props {
  expenses: Expense[]
  userId: string
  userRole: string
  events: { id: string; name: string }[]
  isDirector: boolean
}

const CATEGORY_COLORS: Record<string, string> = {
  transport: 'bg-blue-900/50 text-blue-400',
  material: 'bg-purple-900/50 text-purple-400',
  food: 'bg-orange-900/50 text-orange-400',
  manpower: 'bg-yellow-900/50 text-yellow-400',
  other: 'bg-gray-800 text-gray-400',
}

export default function ExpensesList({ expenses, userId, userRole, events, isDirector }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('all')
  const [loading, setLoading] = useState<string | null>(null)
  const [form, setForm] = useState({ event_id: '', item: '', amount: '', category: 'material' })
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const filtered = filter === 'all' ? expenses : expenses.filter(e => e.status === filter)
  const pendingTotal = expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0)

  async function reviewExpense(id: string, status: 'approved' | 'rejected') {
    setLoading(id)
    await supabase.from('expenses').update({
      status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    router.refresh()
    setLoading(null)
  }

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await supabase.from('expenses').insert({
      event_id: form.event_id,
      submitted_by: userId,
      item: form.item,
      amount: parseFloat(form.amount),
      category: form.category,
      status: 'pending',
    })
    setForm({ event_id: '', item: '', amount: '', category: 'material' })
    setShowForm(false)
    router.refresh()
    setSubmitting(false)
  }

  return (
    <div>
      {/* Summary + Add Button */}
      <div className="flex items-center justify-between mb-5">
        {isDirector && pendingTotal > 0 && (
          <div className="bg-orange-950/50 border border-orange-900/40 rounded-xl px-4 py-2.5">
            <p className="text-orange-400 text-sm font-semibold">
              ₹{pendingTotal.toLocaleString('en-IN')} pending review
            </p>
          </div>
        )}
        {['poc', 'admin'].includes(userRole) && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors ml-auto"
          >
            <Plus size={16} /> Add Expense
          </button>
        )}
      </div>

      {/* Expense Submit Form (POC only) */}
      {showForm && ['poc', 'admin'].includes(userRole) && (
        <form onSubmit={submitExpense} className="bg-gray-900 border border-amber-700/40 rounded-2xl p-5 mb-5 space-y-3">
          <h3 className="text-white font-semibold text-sm">New Expense</h3>
          <select
            value={form.event_id}
            onChange={e => setForm(f => ({ ...f, event_id: e.target.value }))}
            required
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">Select event</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          <input
            type="text"
            value={form.item}
            onChange={e => setForm(f => ({ ...f, item: e.target.value }))}
            required
            placeholder="Item description (e.g. Transport, Flex printing)"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              required
              placeholder="Amount (₹)"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
            />
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="transport">Transport</option>
              <option value="material">Material</option>
              <option value="food">Food</option>
              <option value="manpower">Manpower</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-800 text-gray-400 rounded-xl py-2.5 text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 bg-amber-500 text-black font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      )}

      {/* Filter */}
      <div className="flex gap-1 mb-4 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-1 text-sm py-2 rounded-lg font-medium capitalize transition-colors ${filter === f ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Receipt size={32} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500">No expenses found</p>
          </div>
        )}
        {filtered.map(expense => (
          <div key={expense.id} className={`bg-gray-900 border rounded-2xl p-4 ${
            expense.status === 'pending' ? 'border-orange-900/40' :
            expense.status === 'approved' ? 'border-green-900/40' : 'border-red-900/40'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{expense.item}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-amber-400 font-bold text-sm">₹{expense.amount.toLocaleString('en-IN')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[expense.category] || CATEGORY_COLORS.other}`}>
                    {expense.category}
                  </span>
                  {expense.submitter?.name && (
                    <span className="text-gray-500 text-xs">{expense.submitter.name}</span>
                  )}
                </div>
                <p className="text-gray-600 text-xs mt-1">
                  {expense.events?.name} • {new Date(expense.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 ${
                expense.status === 'pending' ? 'bg-orange-900/50 text-orange-400' :
                expense.status === 'approved' ? 'bg-green-900/50 text-green-400' :
                'bg-red-900/50 text-red-400'
              }`}>
                {expense.status}
              </span>
            </div>

            {isDirector && expense.status === 'pending' && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => reviewExpense(expense.id, 'rejected')}
                  disabled={loading === expense.id}
                  className="flex-1 bg-red-950 hover:bg-red-900 text-red-400 font-medium px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                >
                  <XCircle size={13} /> Reject
                </button>
                <button
                  onClick={() => reviewExpense(expense.id, 'approved')}
                  disabled={loading === expense.id}
                  className="flex-1 bg-green-950 hover:bg-green-900 text-green-400 font-medium px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                >
                  <CheckCircle2 size={13} /> Approve
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
