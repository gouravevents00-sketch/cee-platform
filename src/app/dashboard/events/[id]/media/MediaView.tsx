'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Video, Star, CheckCircle2, Trash2, Camera, Link2, X, Clock } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  uploaded:            { label: 'Uploaded',         color: 'bg-gray-800 text-gray-400' },
  approved_for_social: { label: 'Ready for Social', color: 'bg-amber-900/40 text-amber-400' },
  used:                { label: 'Used in Post',      color: 'bg-green-900/40 text-green-400' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function isImage(url: string) {
  return /\.(jpe?g|png|gif|webp|heic|avif)(\?|$)/i.test(url)
}

export default function MediaView({ eventId, mediaItems, elements, canUpload, canApprove, currentUserId }: {
  eventId: string
  mediaItems: any[]
  elements: { id: string; name: string }[]
  canUpload: boolean
  canApprove: boolean
  currentUserId: string
  userRole: string
}) {
  const [items, setItems] = useState(mediaItems)
  const [showForm, setShowForm] = useState(false)
  const [urlMode, setUrlMode] = useState(false)
  const [caption, setCaption] = useState('')
  const [elementTag, setElementTag] = useState('')
  const [mediaType, setMediaType] = useState('photo')
  const [urlInput, setUrlInput] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter)

  const counts = {
    uploaded: items.filter(i => i.status === 'uploaded').length,
    approved_for_social: items.filter(i => i.status === 'approved_for_social').length,
    used: items.filter(i => i.status === 'used').length,
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    const isVid = file.type.startsWith('video/')
    setMediaType(isVid ? 'video' : 'photo')
    if (!isVid) {
      const reader = new FileReader()
      reader.onload = ev => setPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setPreview(null)
    }
  }

  function resetForm() {
    setCaption('')
    setElementTag('')
    setMediaType('photo')
    setUrlInput('')
    setSelectedFile(null)
    setPreview(null)
    setUrlMode(false)
    setShowForm(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function upload() {
    if (!selectedFile && !urlInput.trim()) return
    setLoading(true)

    let res: Response
    if (selectedFile) {
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('caption', caption)
      fd.append('media_type', mediaType)
      fd.append('element_tag', elementTag)
      res = await fetch(`/api/events/${eventId}/media`, { method: 'POST', body: fd })
    } else {
      const captionFinal = elementTag ? `[${elementTag}]${caption ? ' ' + caption : ''}` : caption
      res = await fetch(`/api/events/${eventId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_url: urlInput, caption: captionFinal, media_type: mediaType }),
      })
    }

    const data = await res.json()
    if (!res.ok) { alert(data.error); setLoading(false); return }
    setItems(i => [data, ...i])
    resetForm()
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

      {/* Upload form */}
      {canUpload && (
        <div className="mb-4">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 text-sm bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Camera size={15} /> Upload Photo / Video
            </button>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-white text-sm font-semibold">Add Media</p>
                <button onClick={resetForm} className="text-gray-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              {/* File picker vs URL toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setUrlMode(false); fileRef.current?.click() }}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    !urlMode ? 'bg-amber-500 text-black border-amber-500 font-semibold' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <Camera size={13} /> Pick from Camera / Gallery
                </button>
                <button
                  onClick={() => setUrlMode(true)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    urlMode ? 'bg-amber-500 text-black border-amber-500 font-semibold' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <Link2 size={13} /> Paste URL
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Preview */}
              {preview && (
                <div className="relative w-full rounded-lg overflow-hidden bg-gray-800" style={{ maxHeight: 200 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="preview" className="w-full object-cover max-h-48" />
                  <button
                    onClick={() => { setSelectedFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                    className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {selectedFile && !preview && (
                <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                  <Video size={14} className="text-gray-400" />
                  <span className="text-gray-300 text-xs truncate">{selectedFile.name}</span>
                  <button
                    onClick={() => { setSelectedFile(null); if (fileRef.current) fileRef.current.value = '' }}
                    className="ml-auto text-gray-500 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* URL input */}
              {urlMode && (
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                  placeholder="Paste Google Drive / WhatsApp / Cloud URL"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                />
              )}

              {/* Caption */}
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                placeholder="Caption (optional)"
                value={caption}
                onChange={e => setCaption(e.target.value)}
              />

              {/* Element tag */}
              {elements.length > 0 && (
                <select
                  value={elementTag}
                  onChange={e => setElementTag(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 text-gray-300"
                >
                  <option value="">Tag an element (optional)</option>
                  {elements.map(el => (
                    <option key={el.id} value={el.name}>{el.name}</option>
                  ))}
                </select>
              )}

              {/* Media type (only relevant for URL mode — auto-detected for files) */}
              {urlMode && (
                <div className="flex gap-2">
                  {['photo', 'video', 'raw'].map(type => (
                    <button
                      key={type}
                      onClick={() => setMediaType(type)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                        mediaType === type
                          ? 'bg-amber-500 text-black border-amber-500 font-semibold'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={upload}
                  disabled={loading || (!selectedFile && !urlInput.trim())}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold py-2 rounded-lg transition-colors disabled:opacity-40"
                >
                  {loading ? 'Uploading…' : 'Upload'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Media list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-600 text-sm">
          {filter === 'all' ? 'No media uploaded yet' : 'No items in this category'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.uploaded
            const showThumb = item.media_type !== 'video' && isImage(item.file_url)
            return (
              <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {showThumb && (
                  <a href={item.file_url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.file_url}
                      alt={item.caption || 'media'}
                      className="w-full object-cover max-h-52"
                    />
                  </a>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-gray-600 capitalize">{item.media_type}</span>
                        {item.created_at && (
                          <span className="flex items-center gap-1 text-xs text-gray-600">
                            <Clock size={10} /> {timeAgo(item.created_at)}
                          </span>
                        )}
                      </div>
                      {item.caption && (
                        <p className="text-gray-300 text-sm mb-1">{item.caption}</p>
                      )}
                      <p className="text-gray-600 text-xs">by {item.uploader?.name || 'Unknown'}</p>
                      {!showThumb && (
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-amber-400 hover:text-amber-300 transition-colors mt-1 inline-block truncate max-w-[240px]"
                        >
                          View file
                        </a>
                      )}
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
