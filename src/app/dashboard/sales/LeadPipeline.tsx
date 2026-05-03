'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Phone, Mail, IndianRupee, Calendar, ChevronDown, ArrowRight, Trophy } from 'lucide-react'

const STATUSES = [
  { key: 'new',            label: 'New',            color: 'bg-gray-800 text-gray-300',        dot: 'bg-gray-500' },
  { key: 'contacted',      label: 'Contacted',      color: 'bg-blue-900/40 text-blue-300',     dot: 'bg-blue-400' },
  { key: 'proposal_sent',  label: 'Proposal Sent',  color: 'bg-purple-900/40 text-purple-300', dot: 'bg-purple-400' },
  { key: 'negotiation',    label: 'Negotiation',    color: 'bg-amber-900/40 text-amber-300',   dot: 'bg-amber-400' },
  { key: 'closed_won',     label: 'Won',            color: 'bg-green-900/40 text-green-300',   dot: 'bg-green-400' },
  { key: 'closed_lost',    label: 'Lost',           color: 'bg-red-900/40 text-red-300',       dot: 'bg-red-500' },
]

const SOURCES = ['referral', 'instagram', 'cold_call', 'expo', 'walk_in', 'repeat', 'other']

const EMPTY_FORM = {
  name: '', company: '', contact_name: '', contact_phone: '', contact_email: '',
  event_type: '', est_budget: '', source: 'referral', assigned_to: '', follow_up_date: '', notes: '',
}

function statusCfg(key: string) {
  return STATUSES.find(s => s.key === key) || STATUSES[0]
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`
  return `₹${n}`
}

export default function LeadPipeline({ leads, profiles, clients, userId, isDirector }: {
  leads: any[]
  profiles: any[]
  clients: any[]
  userId: string
  isDirector: boolean
}) {
  const [items, setItems] = useState(leads)
  const [filter, setFilter] = useState('active') // active | won | lost | all
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const router = useRouter()

  const displayed = items.filter(l => {
    if (filter === 'active') return !['closed_won', 'closed_lost'].includes(l.status)
    if (filter === 'won') return l.status === 'closed_won'
    if (filter === 'lost') return l.status === 'closed_lost'
    return true
  })

  const pipelineValue = items
    .filter(l => !['closed_lost'].includes(l.status))
    .reduce((sum, l) => sum + (l.est_budget || 0), 0)

  const wonValue = items
    .filter(l => l.status === 'closed_won')
    .reduce((sum, l) => sum + (l.est_budget || 0), 0)

  async function addLead() {
    if (!form.name.trim()) return
    setLoading(true)
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, est_budget: Number(form.est_budget) || 0 }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); setLoading(false); return }
    setItems(i => [data, ...i])
    setForm(EMPTY_FORM)
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  async function updateLead(id: string, patch: Record<string, any>) {
    setUpdatingId(id)
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (res.ok) setItems(is => is.map(l => l.id === id ? { ...l, ...data } : l))
    setUpdatingId(null)
    router.refresh()
  }

  async function deleteLead(id: string) {
    if (!confirm('Delete this lead?')) return
    await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    setItems(i => i.filter(l => l.id !== id))
    router.refresh()
  }

  const nextStatus: Record<string, string> = {
    new: 'contacted', contacted: 'proposal_sent', proposal_sent: 'negotiation', negotiation: 'closed_won',
  }

  return (
    <div>
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <p className="text-white text-xl font-bold">{items.filter(l => !['closed_won','closed_lost'].includes(l.status)).length}</p>
          <p className="text-gray-500 text-xs mt-0.5">Active Leads</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <p className="text-amber-400 text-xl font-bold">{fmt(pipelineValue)}</p>
          <p className="text-gray-500 text-xs mt-0.5">Pipeline Value</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <p className="text-green-400 text-xl font-bold">{items.filter(l => l.status === 'closed_won').length}</p>
          <p className="text-gray-500 text-xs mt-0.5">Won</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <p className="text-green-400 text-xl font-bold">{fmt(wonValue)}</p>
          <p className="text-gray-500 text-xs mt-0.5">Won Value</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['active', 'Active'], ['won', 'Won'], ['lost', 'Lost'], ['all', 'All']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              filter === val
                ? 'bg-amber-500 text-black border-amber-500 font-semibold'
                : 'border-gray-700 text-gray-400 hover:border-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lead cards */}
      <div className="space-y-2 mb-4">
        {displayed.length === 0 && (
          <div className="text-center py-12 text-gray-600 text-sm">
            {filter === 'active' ? 'No active leads. Add your first one.' : 'No leads here.'}
          </div>
        )}
        {displayed.map(lead => {
          const cfg = statusCfg(lead.status)
          const isExpanded = expandedId === lead.id
          const today = new Date().toISOString().slice(0, 10)
          const isOverdue = lead.follow_up_date && lead.follow_up_date < today && !['closed_won', 'closed_lost'].includes(lead.status)

          return (
            <div key={lead.id} className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${
              isOverdue ? 'border-red-900/60' : 'border-gray-800'
            }`}>
              <div
                className="flex items-center justify-between gap-3 p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : lead.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white text-sm font-medium">{lead.name}</p>
                      {lead.company && <p className="text-gray-500 text-xs">{lead.company}</p>}
                      {lead.status === 'closed_won' && <Trophy size={13} className="text-amber-400" />}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {lead.est_budget > 0 && (
                        <span className="text-xs text-gray-500 flex items-center gap-0.5">
                          <IndianRupee size={10} />{(lead.est_budget / 100000).toFixed(1)}L
                        </span>
                      )}
                      {lead.follow_up_date && (
                        <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-400' : 'text-gray-500'}`}>
                          <Calendar size={10} /> {new Date(lead.follow_up_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      {lead.assignee?.name && (
                        <span className="text-xs text-gray-600">{lead.assignee.name}</span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronDown size={14} className={`text-gray-600 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </div>

              {isExpanded && (
                <div className="border-t border-gray-800 p-4 space-y-3">
                  {/* Contact info */}
                  <div className="flex gap-4 flex-wrap text-xs text-gray-400">
                    {lead.contact_name && <span>{lead.contact_name}</span>}
                    {lead.contact_phone && (
                      <a href={`tel:${lead.contact_phone}`} className="flex items-center gap-1 hover:text-white transition-colors">
                        <Phone size={11} /> {lead.contact_phone}
                      </a>
                    )}
                    {lead.contact_email && (
                      <a href={`mailto:${lead.contact_email}`} className="flex items-center gap-1 hover:text-white transition-colors">
                        <Mail size={11} /> {lead.contact_email}
                      </a>
                    )}
                    {lead.event_type && <span>Type: {lead.event_type}</span>}
                    {lead.source && <span>Source: {lead.source}</span>}
                  </div>

                  {lead.notes && (
                    <p className="text-gray-400 text-sm">{lead.notes}</p>
                  )}

                  {/* Move forward / close actions */}
                  {!['closed_won', 'closed_lost'].includes(lead.status) && (
                    <div className="flex gap-2 flex-wrap">
                      {nextStatus[lead.status] && (
                        <button
                          onClick={() => updateLead(lead.id, { status: nextStatus[lead.status] })}
                          disabled={updatingId === lead.id}
                          className="flex items-center gap-1.5 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Move to {statusCfg(nextStatus[lead.status]).label} <ArrowRight size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => updateLead(lead.id, { status: 'closed_won' })}
                        disabled={updatingId === lead.id}
                        className="text-xs bg-green-900/30 border border-green-800/40 text-green-400 hover:bg-green-900/50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Mark Won
                      </button>
                      <button
                        onClick={() => updateLead(lead.id, { status: 'closed_lost' })}
                        disabled={updatingId === lead.id}
                        className="text-xs bg-red-900/20 border border-red-900/30 text-red-500 hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Mark Lost
                      </button>
                    </div>
                  )}

                  {/* Won — link to client */}
                  {lead.status === 'closed_won' && !lead.client_id && (
                    <div className="bg-green-950/30 border border-green-900/30 rounded-lg p-3">
                      <p className="text-green-400 text-xs font-semibold mb-2">Deal Won — Create Client Record</p>
                      <div className="flex gap-2">
                        <select
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-green-500"
                          onChange={e => { if (e.target.value) updateLead(lead.id, { client_id: e.target.value }) }}
                          defaultValue=""
                        >
                          <option value="">Link to existing client…</option>
                          {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <a
                          href="/dashboard/clients/new"
                          className="text-xs bg-green-900/40 border border-green-800/40 text-green-400 px-3 py-1.5 rounded-lg hover:bg-green-900/60 transition-colors whitespace-nowrap"
                        >
                          New Client
                        </a>
                      </div>
                    </div>
                  )}

                  {lead.status === 'closed_won' && lead.client && (
                    <div className="flex items-center gap-2 text-xs text-green-400">
                      <Trophy size={12} /> Linked to client: <span className="font-semibold">{lead.client.name}</span>
                    </div>
                  )}

                  {/* Assign + follow-up date edit */}
                  <div className="flex gap-2 flex-wrap">
                    <select
                      className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-300 text-xs focus:outline-none focus:border-amber-500"
                      value={lead.assigned_to || ''}
                      onChange={e => updateLead(lead.id, { assigned_to: e.target.value || null })}
                    >
                      <option value="">Unassigned</option>
                      {profiles.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input
                      type="date"
                      className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-300 text-xs focus:outline-none focus:border-amber-500"
                      value={lead.follow_up_date || ''}
                      onChange={e => updateLead(lead.id, { follow_up_date: e.target.value || null })}
                    />
                  </div>

                  {/* Delete */}
                  {isDirector && (
                    <button
                      onClick={() => deleteLead(lead.id)}
                      className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} /> Delete Lead
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
        >
          <Plus size={16} /> Add Lead
        </button>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <p className="text-white text-sm font-semibold">New Lead</p>

          <div className="grid grid-cols-2 gap-3">
            <input
              className="col-span-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              placeholder="Event / Opportunity name *"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <input
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              placeholder="Company / Client name"
              value={form.company}
              onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
            />
            <input
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              placeholder="Contact person"
              value={form.contact_name}
              onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
            />
            <input
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              placeholder="Phone"
              value={form.contact_phone}
              onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
            />
            <input
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              placeholder="Email"
              value={form.contact_email}
              onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
            />
            <input
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              placeholder="Event type (Corporate, Wedding…)"
              value={form.event_type}
              onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
            />
            <input
              type="number"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              placeholder="Est. budget (₹)"
              value={form.est_budget}
              onChange={e => setForm(f => ({ ...f, est_budget: e.target.value }))}
            />
            <select
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
            >
              {SOURCES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <select
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              value={form.assigned_to}
              onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
            >
              <option value="">Assign to (optional)</option>
              {profiles.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input
              type="date"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              value={form.follow_up_date}
              onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))}
              placeholder="Follow-up date"
            />
            <textarea
              className="col-span-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
              placeholder="Notes"
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={addLead}
              disabled={loading}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Add Lead'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              className="px-4 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
