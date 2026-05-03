'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, UserCircle2, Briefcase } from 'lucide-react'

const DEPT_LABELS: Record<string, string> = {
  admin: 'Admin', design: 'Design', poc: 'POC', accounts: 'Accounts', operations: 'Operations', other: 'Other'
}
const DEPT_COLORS: Record<string, string> = {
  admin: 'bg-blue-900/40 text-blue-400',
  design: 'bg-purple-900/40 text-purple-400',
  poc: 'bg-amber-900/40 text-amber-400',
  accounts: 'bg-green-900/40 text-green-400',
  operations: 'bg-orange-900/40 text-orange-400',
  other: 'bg-gray-800 text-gray-400',
}

const EMPTY = { user_id: '', freelancer_name: '', role_in_event: '', department: 'other', is_freelancer: false, notes: '' }

export default function EventTeamView({ eventId, teamMembers, allProfiles, canManage, currentUserId }: {
  eventId: string
  teamMembers: any[]
  allProfiles: any[]
  canManage: boolean
  currentUserId: string
}) {
  const [members, setMembers] = useState(teamMembers)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const router = useRouter()

  async function addMember() {
    if (!form.role_in_event.trim()) return
    if (!form.is_freelancer && !form.user_id) return
    if (form.is_freelancer && !form.freelancer_name.trim()) return
    setLoading(true)
    const res = await fetch(`/api/events/${eventId}/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); setLoading(false); return }
    setMembers(m => [...m, data])
    setForm(EMPTY)
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  async function removeMember(memberId: string) {
    setRemoving(memberId)
    await fetch(`/api/events/${eventId}/team?memberId=${memberId}`, { method: 'DELETE' })
    setMembers(m => m.filter(x => x.id !== memberId))
    setRemoving(null)
    router.refresh()
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {['admin','design','poc'].map(dept => {
          const count = members.filter(m => m.department === dept).length
          return (
            <div key={dept} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <p className="text-white text-xl font-bold">{count}</p>
              <p className="text-gray-500 text-xs mt-0.5">{DEPT_LABELS[dept]}</p>
            </div>
          )
        })}
      </div>

      {/* Member list */}
      <div className="space-y-2 mb-4">
        {members.length === 0 && (
          <div className="text-center py-12 text-gray-600 text-sm">No team members added yet</div>
        )}
        {members.map(m => (
          <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                {m.is_freelancer
                  ? <Briefcase size={16} className="text-gray-500" />
                  : <UserCircle2 size={16} className="text-gray-500" />
                }
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {m.is_freelancer ? m.freelancer_name : (m.member?.name || 'Unknown')}
                  {m.is_freelancer && <span className="ml-2 text-xs text-gray-500">(Freelancer)</span>}
                </p>
                <p className="text-gray-500 text-xs truncate">{m.role_in_event}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DEPT_COLORS[m.department] || DEPT_COLORS.other}`}>
                {DEPT_LABELS[m.department] || m.department}
              </span>
              {canManage && (
                <button
                  onClick={() => removeMember(m.id)}
                  disabled={removing === m.id}
                  className="text-gray-600 hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {canManage && (
        <>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Plus size={16} /> Add Team Member
            </button>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-white text-sm font-semibold">Add Member</p>

              {/* Internal vs Freelancer toggle */}
              <div className="flex gap-2">
                {['Internal Staff', 'Freelancer'].map((label, i) => (
                  <button
                    key={label}
                    onClick={() => setForm(f => ({ ...f, is_freelancer: i === 1, user_id: '', freelancer_name: '' }))}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      form.is_freelancer === (i === 1)
                        ? 'bg-amber-500 text-black border-amber-500 font-semibold'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {form.is_freelancer ? (
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                  placeholder="Freelancer name"
                  value={form.freelancer_name}
                  onChange={e => setForm(f => ({ ...f, freelancer_name: e.target.value }))}
                />
              ) : (
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                  value={form.user_id}
                  onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
                >
                  <option value="">Select team member</option>
                  {allProfiles.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                  ))}
                </select>
              )}

              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                placeholder="Role in this event (e.g. Stage Manager, Photographer)"
                value={form.role_in_event}
                onChange={e => setForm(f => ({ ...f, role_in_event: e.target.value }))}
              />

              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              >
                {Object.entries(DEPT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />

              <div className="flex gap-2 pt-1">
                <button
                  onClick={addMember}
                  disabled={loading}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Adding…' : 'Add Member'}
                </button>
                <button
                  onClick={() => { setShowForm(false); setForm(EMPTY) }}
                  className="px-4 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
