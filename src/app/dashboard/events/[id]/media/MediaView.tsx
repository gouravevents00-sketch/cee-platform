'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Image, Video, Star, CheckCircle2, Trash2 } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  uploaded:            { label: 'Uploaded',           color: 'bg-gray-800 text-gray-400' },
  approved_for_social: { label: 'Ready for Social',   color: 'bg-amber-900/40 text-amber-400' },
  used:                { label: 'Used in Post',        color: 'bg-green-900/40 text-green-400' },
}

const EMPTY_FORM = { file_url: '', caption: '', media_type: 'photo' }

export default function MediaView({ eventId, mediaItems, canUpload, canApprove, currentUserId, userRole }: {
  eventId: string
  mediaItems: any[]
  canUpload: boolean
  canApprove: boolean
  currentUserId: string
  userRole: string
}) {
  const [items, setItems] = useState(mediaItems)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const router = useRouter()

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter)

  async function upload() {
    if (!form.file_url.trim()) return
    setLoading(true)
    const res = await fetch(`/api/events/${eventId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); setLoading(false); return }
    setItems(i => [data, ...i])
    setForm(EMPTY_FORM)
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/media/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) setItems(items => items.map(i => i.id === id ? { ...i, status } : i))
    router.refresh()
  }

  async function deleteMedia(id: string) {
    if (!confirm('Delete this media?')) return
    await fetch(`/api/media/${id}`, { method: 'DELETE' })
    setItems(i => i.filter(x => x.id !== id))
    router.refresh()
  }

  const counts = {
    uploaded: items.filter(i => i.status === 'uploaded').length,
    approved_for_social: items.filter(i => i.status === 'approved_for_social').length,
    used: items.filter(i => i.status === 'used').length,
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-white text-xl font-bold">{items.length}</p>
          <p className="text-gray-500 text-xs mt-0.5">Total</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-amber-400 text-xl font-bold">{counts.approved_for_social}</p>
          <p className="text-gray-500 text-xs mt-0.5">For Social</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-green-400 text-xl font-bold">{counts.used}</p>
          <p className="text-gray-500 text-xs mt-0.5">Used</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['all', 'All'], ['uploaded', 'Uploaded'], ['approved_for_social', 'For Social'], ['used', 'Used']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              filter === val
                ? 'bg-amber-500 text-black border-amber-500 font-semibold'
                : 'border-gray-700 text-gray-400 hover:border-gray-600'
            }`}
          >
            {label} {val !== 'all' && `(${counts[val as keyof typeof counts] ?? items.length})`}
          </button>
        ))}
      </div>

      {/* Media grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-600 text-sm">
          {filter === 'all' ? 'No media uploaded yet' : 'No items in this category'}
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {filtered.map(item => {
            const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.uploaded
            return (
              <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {item.media_type === 'video'
                        ? <Video size={16} className="text-gray-500" />
                        : <Image size={16} className="text-gray-500" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-gray-600 capitalize">{item.media_type}</span>
                      </div>
                      {item.caption && (
                        <p className="text-gray-300 text-sm mb-1">{item.caption}</p>
                      )}
                      <p className="text-gray-600 text-xs">by {item.uploader?.name || 'Unknown'}</p>
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-400 hover:text-amber-300 transition-colors mt-1 inline-block truncate max-w-[240px]"
                      >
                        {item.file_url}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canApprove && item.status === 'uploaded' && (
                      <button
                        onClick={() => updateStatus(item.id, 'approved_for_social')}
                        title="Approve for social"
                        className="p-1.5 text-gray-500 hover:text-amber-400 transition-colors"
                      >
                        <Star size={15} />
                      </button>
                    )}
                    {canApprove && item.status === 'approved_for_social' && (
                      <button
                        onClick={() => updateStatus(item.id, 'used')}
                        title="Mark as used"
                        className="p-1.5 text-gray-500 hover:text-green-400 transition-colors"
                      >
                        <CheckCircle2 size={15} />
                      </button>
                    )}
                    {(canUpload || item.uploaded_by === currentUserId) && (
                      <button
                        onClick={() => deleteMedia(item.id)}
                        className="p-1.5 text-gray-700 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Upload form */}
      {canUpload && (
        <>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Plus size={16} /> Upload Media
            </button>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-white text-sm font-semibold">Add Media</p>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                placeholder="File URL (Google Drive / WhatsApp / Cloud link)"
                value={form.file_url}
                onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))}
              />
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                placeholder="Caption (optional)"
                value={form.caption}
                onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
              />
              <div className="flex gap-2">
                {['photo', 'video', 'raw'].map(type => (
                  <button
                    key={type}
                    onClick={() => setForm(f => ({ ...f, media_type: type }))}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                      form.media_type === type
                        ? 'bg-amber-500 text-black border-amber-500 font-semibold'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={upload}
                  disabled={loading}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Uploading…' : 'Save Media'}
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
        </>
      )}
    </div>
  )
}
