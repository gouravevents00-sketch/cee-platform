'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { AlertCircle, Clock, Copy, Check, IndianRupee, Phone, Sparkles, MessageCircle } from 'lucide-react'

interface Payment {
  id: string
  type: 'advance' | 'milestone' | 'final'
  amount: number
  due_date?: string
  status: 'pending' | 'overdue'
  notes?: string
  events?: {
    id: string
    name: string
    clients?: {
      name: string
      type: 'agency' | 'corporate' | 'government' | 'individual'
      contact_name?: string
      contact_phone?: string
      credit_period_days: number
    }
  }
}

function daysOverdue(due: string) {
  const diff = Math.floor((Date.now() - new Date(due).getTime()) / 86400000)
  return diff
}

function getTemplate(payment: Payment, urgency: 'friendly' | 'firm' | 'formal') {
  const client = payment.events?.clients
  const event = payment.events
  const clientType = client?.type || 'individual'
  const contact = client?.contact_name || 'Team'
  const amount = `₹${payment.amount.toLocaleString('en-IN')}`
  const dueStr = payment.due_date ? new Date(payment.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'as agreed'

  if (clientType === 'agency') {
    if (urgency === 'friendly') return `Hi ${contact},\n\nHope you're doing well! Just a quick check-in regarding the ${payment.type} payment of ${amount} for *${event?.name}*, which was due on ${dueStr}.\n\nCould you let us know the expected date of transfer? Happy to provide any paperwork needed.\n\nThanks,\nCreative Era Events`
    if (urgency === 'firm') return `Hi ${contact},\n\nThis is a follow-up on the pending ${payment.type} payment of ${amount} for *${event?.name}* (due: ${dueStr}).\n\nAs this has been pending for a while, we request you to please process this at the earliest. Do let us know if there's anything holding it up.\n\nRegards,\nCreative Era Events`
    return `Dear ${contact},\n\nDespite our earlier reminders, the ${payment.type} payment of ${amount} for *${event?.name}* (originally due: ${dueStr}) remains outstanding.\n\nWe request immediate action on this payment to avoid any disruption in our future working relationship.\n\nRegards,\nCreative Era Events`
  }

  if (clientType === 'corporate') {
    if (urgency === 'friendly') return `Dear ${contact},\n\nGreetings from Creative Era Events!\n\nThis is a gentle reminder regarding the ${payment.type} of ${amount} for *${event?.name}*, which was scheduled for ${dueStr}.\n\nKindly request you to initiate the payment process at your earliest convenience. Please share the payment confirmation once processed.\n\nBest regards,\nCreative Era Events`
    if (urgency === 'firm') return `Dear ${contact},\n\nAs per our records, the ${payment.type} payment of ${amount} for *${event?.name}* (due: ${dueStr}) is now overdue.\n\nWe would appreciate if this could be prioritised and processed within the next 3 working days. Please feel free to reach out if you require any documentation.\n\nBest regards,\nCreative Era Events`
    return `Dear ${contact},\n\nThis is a formal notice regarding the outstanding ${payment.type} payment of ${amount} pertaining to *${event?.name}* (due: ${dueStr}).\n\nDespite multiple reminders, the payment remains pending. We request immediate settlement to avoid any further escalation.\n\nBest regards,\nCreative Era Events`
  }

  if (clientType === 'government') {
    if (urgency === 'friendly') return `Respected ${contact},\n\nWith reference to *${event?.name}*, this is to bring to your attention that the ${payment.type} amount of ${amount} (due: ${dueStr}) is currently pending.\n\nKindly request you to initiate the payment process as per the approved work order. Please advise the expected payment date.\n\nYours faithfully,\nCreative Era Events`
    if (urgency === 'firm') return `Respected ${contact},\n\nAs per our records and as agreed in the work order for *${event?.name}*, the ${payment.type} payment of ${amount} was due on ${dueStr} and remains pending.\n\nWe humbly request that the payment be processed at the earliest to facilitate closure of this work order.\n\nYours faithfully,\nCreative Era Events`
    return `Respected ${contact},\n\nThis is a formal reminder with reference to the work order for *${event?.name}*. The ${payment.type} payment of ${amount} (originally due: ${dueStr}) has been pending for an extended period.\n\nWe request your office to kindly expedite the payment process. All necessary documentation has already been submitted.\n\nYours faithfully,\nCreative Era Events`
  }

  return `Hi ${contact},\n\nJust a reminder that a payment of ${amount} for *${event?.name}* is due (${dueStr}).\n\nKindly process this at your earliest.\n\nThank you,\nCreative Era Events`
}

export default function FollowUpDashboard({ payments, isDirector }: { payments: Payment[], isDirector: boolean }) {
  const [filter, setFilter] = useState<'all' | 'overdue' | 'pending'>('all')
  const [openTemplate, setOpenTemplate] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [marking, setMarking] = useState<string | null>(null)
  const [aiMessages, setAiMessages] = useState<Record<string, string>>({})
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function generateAiMessage(p: Payment) {
    setAiLoading(p.id)
    const client = p.events?.clients
    const days = p.due_date && p.status === 'overdue' ? daysOverdue(p.due_date) : 0
    const urgency = getUrgency(p)
    const res = await fetch('/api/ai/followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: client?.name || '',
        contact_name: client?.contact_name || '',
        client_type: client?.type || 'individual',
        event_name: p.events?.name || '',
        amount: p.amount,
        payment_type: p.type,
        days_overdue: days,
        urgency,
      }),
    })
    const data = await res.json()
    if (data.message) setAiMessages(m => ({ ...m, [p.id]: data.message }))
    setAiLoading(null)
  }

  function getWhatsAppUrl(p: Payment, text: string) {
    const raw = p.events?.clients?.contact_phone?.replace(/\D/g, '') || ''
    // If 10 digits → prepend 91; if already 12 digits starting with 91 → use as-is
    const phone = raw.length === 10 ? `91${raw}` : raw.length === 12 && raw.startsWith('91') ? raw : raw
    const encodedText = encodeURIComponent(text)
    return phone ? `https://wa.me/${phone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`
  }

  const filtered = filter === 'all' ? payments : payments.filter(p => p.status === filter)
  const overdueCount = payments.filter(p => p.status === 'overdue').length

  async function markOverdue(id: string) {
    setMarking(id)
    await supabase.from('payments').update({ status: 'overdue' }).eq('id', id)
    router.refresh()
    setMarking(null)
  }

  async function markReceived(id: string) {
    setMarking(id)
    await supabase.from('payments').update({
      status: 'received',
      received_date: new Date().toISOString().split('T')[0],
    }).eq('id', id)
    router.refresh()
    setMarking(null)
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function getUrgency(p: Payment): 'friendly' | 'firm' | 'formal' {
    if (p.status !== 'overdue' || !p.due_date) return 'friendly'
    const days = daysOverdue(p.due_date)
    if (days <= 5) return 'friendly'
    if (days <= 14) return 'firm'
    return 'formal'
  }

  const inputClass = "text-xs bg-gray-800 border border-gray-700 rounded-xl"

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-900 border border-red-900/30 rounded-2xl p-4 text-center">
          <p className="text-red-400 text-xl font-bold">{overdueCount}</p>
          <p className="text-gray-500 text-xs mt-0.5">Overdue</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
          <p className="text-amber-400 text-xl font-bold">{payments.filter(p => p.status === 'pending').length}</p>
          <p className="text-gray-500 text-xs mt-0.5">Pending</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
          <p className="text-white text-xl font-bold">
            ₹{(payments.reduce((s, p) => s + p.amount, 0) / 1000).toFixed(0)}K
          </p>
          <p className="text-gray-500 text-xs mt-0.5">Total Outstanding</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5">
        {(['all', 'overdue', 'pending'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-amber-500 text-black' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'}`}>
            {f === 'all' ? 'All' : f === 'overdue' ? '🔴 Overdue' : '⏳ Pending'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
          <IndianRupee size={28} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No outstanding payments</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const overdueDays = p.due_date && p.status === 'overdue' ? daysOverdue(p.due_date) : null
            const urgency = getUrgency(p)
            const template = getTemplate(p, urgency)
            const isOpen = openTemplate === p.id
            const urgencyColors = { friendly: 'text-blue-400', firm: 'text-amber-400', formal: 'text-red-400' }

            return (
              <div key={p.id} className={`bg-gray-900 border rounded-2xl overflow-hidden ${p.status === 'overdue' ? 'border-red-900/40' : 'border-gray-800'}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {p.status === 'overdue'
                          ? <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                          : <Clock size={14} className="text-amber-400 flex-shrink-0" />
                        }
                        <span className="text-white font-semibold">₹{p.amount.toLocaleString('en-IN')}</span>
                        <span className="text-gray-500 text-xs capitalize">{p.type}</span>
                        {overdueDays !== null && overdueDays > 0 && (
                          <span className="text-red-400 text-xs font-medium">{overdueDays}d overdue</span>
                        )}
                      </div>
                      <a href={`/dashboard/events/${p.events?.id}`} className="text-amber-500 hover:text-amber-400 text-sm font-medium transition-colors">
                        {p.events?.name || 'Unknown Event'}
                      </a>
                      {p.events?.clients && (
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-gray-400 text-xs">{p.events.clients.name}</span>
                          <span className={`text-xs capitalize ${p.events.clients.type === 'agency' ? 'text-blue-400' : p.events.clients.type === 'corporate' ? 'text-purple-400' : p.events.clients.type === 'government' ? 'text-amber-400' : 'text-gray-400'}`}>
                            {p.events.clients.type}
                          </span>
                          {p.events.clients.contact_phone && (
                            <a href={`tel:${p.events.clients.contact_phone}`} className="flex items-center gap-1 text-gray-500 hover:text-white text-xs transition-colors">
                              <Phone size={10} /> {p.events.clients.contact_phone}
                            </a>
                          )}
                        </div>
                      )}
                      {p.due_date && (
                        <p className="text-gray-600 text-xs mt-0.5">Due: {new Date(p.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      )}
                      {p.notes && <p className="text-gray-600 text-xs mt-0.5 italic">{p.notes}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setOpenTemplate(isOpen ? null : p.id)}
                        className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg whitespace-nowrap"
                      >
                        {isOpen ? 'Hide' : 'Message'}
                      </button>
                      {isDirector && p.status === 'pending' && (
                        <button onClick={() => markOverdue(p.id)} disabled={marking === p.id} className="text-xs bg-red-950 hover:bg-red-900 text-red-400 px-3 py-1.5 rounded-lg">
                          Mark Overdue
                        </button>
                      )}
                      {isDirector && (
                        <button onClick={() => markReceived(p.id)} disabled={marking === p.id} className="text-xs bg-green-950 hover:bg-green-900 text-green-400 px-3 py-1.5 rounded-lg">
                          Received ✓
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Message Template */}
                {isOpen && (
                  <div className="border-t border-gray-800 bg-gray-950 p-4 space-y-3">
                    {/* Template header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-gray-500 text-xs">
                        Follow-up · <span className={`font-medium capitalize ${urgencyColors[urgency]}`}>{urgency}</span> tone
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => generateAiMessage(p)}
                          disabled={aiLoading === p.id}
                          className="flex items-center gap-1.5 text-xs bg-purple-950 hover:bg-purple-900 text-purple-400 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Sparkles size={11} /> {aiLoading === p.id ? 'Writing...' : 'AI Personalise'}
                        </button>
                        <button
                          onClick={() => copyText(aiMessages[p.id] || template, p.id)}
                          className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {copied === p.id ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                        </button>
                      </div>
                    </div>

                    {/* Message text */}
                    <pre className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-gray-900 border border-gray-800 rounded-xl p-3">
                      {aiMessages[p.id] || template}
                    </pre>

                    {/* WhatsApp send button */}
                    <a
                      href={getWhatsAppUrl(p, aiMessages[p.id] || template)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-green-950 hover:bg-green-900 text-green-400 text-xs font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      <MessageCircle size={13} /> Send via WhatsApp
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
