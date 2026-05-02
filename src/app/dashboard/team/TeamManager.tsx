'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Shield, User } from 'lucide-react'
import { ROLE_LABELS, Role } from '@/lib/types'

interface Profile {
  id: string
  name: string
  role: Role
  email: string
}

const ROLE_COLORS: Record<Role, string> = {
  director: 'bg-amber-900/50 text-amber-400',
  admin: 'bg-blue-900/50 text-blue-400',
  design: 'bg-purple-900/50 text-purple-400',
  poc: 'bg-green-900/50 text-green-400',
  accounts: 'bg-orange-900/50 text-orange-400',
}

export default function TeamManager({ team, currentUserId }: { team: Profile[], currentUserId: string }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'poc' as Role })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Create auth user via admin API (requires service role — so we use a server action approach)
    // For now, instruct director to create via Supabase dashboard + we insert profile
    const res = await fetch('/api/team/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Failed to create team member.')
      setLoading(false)
      return
    }

    setForm({ name: '', email: '', password: '', role: 'poc' })
    setShowForm(false)
    router.refresh()
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this team member?')) return
    setDeleting(id)
    await fetch('/api/team/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })
    router.refresh()
    setDeleting(null)
  }

  const inputClass = "w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition-colors placeholder-gray-600"

  return (
    <div>
      {/* Add Member Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          <Plus size={16} /> Add Member
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-gray-900 border border-amber-700/40 rounded-2xl p-5 mb-5 space-y-3">
          <h3 className="text-white font-semibold">New Team Member</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              placeholder="Full Name"
              className={inputClass}
            />
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
              className={inputClass}
            >
              {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
            </select>
          </div>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            required
            placeholder="Email address"
            className={inputClass}
          />
          <input
            type="password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            required
            placeholder="Temporary password"
            minLength={6}
            className={inputClass}
          />
          {error && (
            <div className="bg-red-950 border border-red-900 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl py-2.5 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-xl py-2.5 text-sm">
              {loading ? 'Creating...' : 'Create Member'}
            </button>
          </div>
        </form>
      )}

      {/* Team List */}
      <div className="space-y-2">
        {team.map(member => (
          <div key={member.id} className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                {member.role === 'director' ? <Shield size={16} className="text-amber-400" /> : <User size={16} className="text-gray-400" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium text-sm">{member.name}</p>
                  {member.id === currentUserId && (
                    <span className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">You</span>
                  )}
                </div>
                <p className="text-gray-500 text-xs">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[member.role]}`}>
                {ROLE_LABELS[member.role]}
              </span>
              {member.id !== currentUserId && (
                <button
                  onClick={() => handleDelete(member.id)}
                  disabled={deleting === member.id}
                  className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
