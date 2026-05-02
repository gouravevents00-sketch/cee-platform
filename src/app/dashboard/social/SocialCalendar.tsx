'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Camera, Play, MessageCircle, CheckCircle2, Clock, Send, FileEdit, Sparkles } from 'lucide-react'

interface Post {
  id: string
  event_id?: string
  platform: string
  content_type?: string
  caption?: string
  scheduled_date?: string
  status: 'draft' | 'pending_approval' | 'approved' | 'posted'
  file_url?: string
  notes?: string
  events?: { name: string }
  creator?: { name: string }
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Camera size={14} />,
  youtube: <Play size={14} />,
  whatsapp: <MessageCircle size={14} />,
  linkedin: <Send size={14} />,
  other: <FileEdit size={14} />,
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-900/50 text-pink-400',
  youtube: 'bg-red-900/50 text-red-400',
  whatsapp: 'bg-green-900/50 text-green-400',
  linkedin: 'bg-blue-900/50 text-blue-400',
  other: 'bg-gray-800 text-gray-400',
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-800 text-gray-400', icon: <FileEdit size={12} /> },
  pending_approval: { label: 'Pending Approval', color: 'bg-amber-900/50 text-amber-400', icon: <Clock size={12} /> },
  approved: { label: 'Approved', color: 'bg-blue-900/50 text-blue-400', icon: <CheckCircle2 size={12} /> },
  posted: { label: 'Posted', color: 'bg-green-900/50 text-green-400', icon: <CheckCircle2 size={12} /> },
}

const EMPTY_FORM = { event_id: '', platform: 'instagram', content_type: 'reel', caption: '', scheduled_date: '', notes: '' }

export default function SocialCalendar({ posts, events, userId, userRole, isDirector }: {
  posts: Post[], events: { id: string; name: string }[],
  userId: string, userRole: string, isDirector: boolean
}) {
  const [filter, setFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function generateCaption() {
    setAiLoading(true)
    const linkedEvent = events.find(e => e.id === form.event_id)
    const res = await fetch('/api/ai/caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: form.platform,
        content_type: form.content_type,
        event_name: linkedEvent?.name || '',
        notes: form.notes,
      }),
    })
    const data = await res.json()
    if (data.caption) setForm(f => ({ ...f, caption: data.caption }))
    setAiLoading(false)
  }

  const filtered = filter === 'all' ? posts : posts.filter(p =>
    filter === 'pending' ? p.status === 'pending_approval' : p.platform === filter
  )

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('social_posts').insert({
      ...form,
      event_id: form.event_id || null,
      scheduled_date: form.scheduled_date || null,
      created_by: userId,
      status: 'draft',
    })
    setForm(EMPTY_FORM)
    setShowForm(false)
    router.refresh()
    setLoading(false)
  }

  async function updateStatus(id: string, status: Post['status']) {
    setUpdating(id)
    const update: any = { status }
    if (status === 'approved') {
      update.approved_by = userId
      update.approved_at = new Date().toISOString()
    }
    await supabase.from('social_posts').update(update).eq('id', id)
    router.refresh()
    setUpdating(null)
  }

  const inputClass = "w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600"

  return (
    <div>
      {/* Filter bar */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {['all', 'pending', 'instagram', 'youtube', 'whatsapp'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors capitalize ${filter === f ? 'bg-amber-500 text-black' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'}`}>
            {f === 'pending' ? '⏳ Needs Approval' : f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button
          onClick={() => setShowForm(!showForm)}
          className="ml-auto flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-1.5 rounded-xl text-xs whitespace-nowrap"
        >
          <Plus size={13} /> New Post
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-gray-900 border border-amber-700/40 rounded-2xl p-5 mb-5 space-y-3">
          <h3 className="text-white font-semibold text-sm">New Content</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Platform *</label>
              <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className={inputClass}>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="linkedin">LinkedIn</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Content Type</label>
              <select value={form.content_type} onChange={e => setForm(f => ({ ...f, content_type: e.target.value }))} className={inputClass}>
                <option value="reel">Reel</option>
                <option value="post">Post</option>
                <option value="story">Story</option>
                <option value="video">Video</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Linked Event</label>
              <select value={form.event_id} onChange={e => setForm(f => ({ ...f, event_id: e.target.value }))} className={inputClass}>
                <option value="">Not linked to event</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Scheduled Date</label>
              <input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">Caption</label>
              <button
                type="button"
                onClick={generateCaption}
                disabled={aiLoading}
                className="flex items-center gap-1.5 text-xs bg-purple-950 hover:bg-purple-900 text-purple-400 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
              >
                <Sparkles size={11} /> {aiLoading ? 'Generating...' : 'AI Generate'}
              </button>
            </div>
            <textarea value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} rows={4} className={inputClass} placeholder="Write caption or use AI Generate above..." />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputClass} placeholder="Any instructions for design team..." />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-800 text-gray-400 rounded-xl py-2.5 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-amber-500 text-black font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50">
              {loading ? 'Saving...' : 'Save as Draft'}
            </button>
          </div>
        </form>
      )}

      {/* Posts Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
          <p className="text-gray-500">No content found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(post => {
            const statusCfg = STATUS_CONFIG[post.status]
            return (
              <div key={post.id} className={`bg-gray-900 border rounded-2xl p-4 ${post.status === 'pending_approval' ? 'border-amber-900/40' : 'border-gray-800'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLORS[post.platform]}`}>
                        {PLATFORM_ICONS[post.platform]} {post.platform}
                      </span>
                      {post.content_type && (
                        <span className="text-xs text-gray-500 capitalize">{post.content_type}</span>
                      )}
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                        {statusCfg.icon} {statusCfg.label}
                      </span>
                    </div>
                    {post.caption && (
                      <p className="text-gray-300 text-sm leading-relaxed line-clamp-2">{post.caption}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-gray-500">
                      {post.events?.name && <span>📅 {post.events.name}</span>}
                      {post.scheduled_date && <span>🗓 {new Date(post.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                      {post.creator?.name && <span>by {post.creator.name}</span>}
                    </div>
                    {post.notes && <p className="text-gray-600 text-xs mt-1 italic">{post.notes}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {/* Design/Admin: Submit for approval */}
                    {!isDirector && post.status === 'draft' && (
                      <button
                        onClick={() => updateStatus(post.id, 'pending_approval')}
                        disabled={updating === post.id}
                        className="text-xs bg-amber-900/50 hover:bg-amber-900 text-amber-400 px-3 py-1.5 rounded-lg whitespace-nowrap"
                      >
                        Submit for Approval
                      </button>
                    )}
                    {/* Director: Approve */}
                    {isDirector && post.status === 'pending_approval' && (
                      <button
                        onClick={() => updateStatus(post.id, 'approved')}
                        disabled={updating === post.id}
                        className="text-xs bg-green-950 hover:bg-green-900 text-green-400 px-3 py-1.5 rounded-lg"
                      >
                        Approve
                      </button>
                    )}
                    {/* Mark as posted */}
                    {(isDirector || userRole === 'admin') && post.status === 'approved' && (
                      <button
                        onClick={() => updateStatus(post.id, 'posted')}
                        disabled={updating === post.id}
                        className="text-xs bg-blue-950 hover:bg-blue-900 text-blue-400 px-3 py-1.5 rounded-lg"
                      >
                        Mark Posted
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
