'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Paperclip, CheckCircle2, Clock, RotateCcw, Pencil, Trash2 } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  briefed:     { label: 'Briefed',      color: 'bg-gray-800 text-gray-400' },
  in_progress: { label: 'In Progress',  color: 'bg-blue-900/40 text-blue-400' },
  review:      { label: 'In Review',    color: 'bg-amber-900/40 text-amber-400' },
  revision:    { label: 'Revision',     color: 'bg-red-900/40 text-red-400' },
  approved:    { label: 'Approved',     color: 'bg-green-900/40 text-green-400' },
}

const EMPTY_FORM = { title: '', brief: '', assigned_to: '', element_id: '' }

export default function ArtworkView({ eventId, artworkTasks, designers, elements, canBrief, isDesign, canApprove, currentUserId }: {
  eventId: string
  artworkTasks: any[]
  designers: any[]
  elements: any[]
  canBrief: boolean
  isDesign: boolean
  canApprove: boolean
  currentUserId: string
}) {
  const [tasks, setTasks] = useState(artworkTasks)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [revisionInput, setRevisionInput] = useState<Record<string, string>>({})
  const [fileInput, setFileInput] = useState<Record<string, string>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const router = useRouter()

  async function addTask() {
    if (!form.title.trim()) return
    setLoading(true)
    const res = await fetch(`/api/events/${eventId}/artwork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); setLoading(false); return }
    setTasks(t => [...t, data])
    setForm(EMPTY_FORM)
    setShowForm(false)
    setLoading(false)
    router.refresh()
  }

  async function patchTask(id: string, patch: Record<string, any>) {
    setUpdating(id)
    const res = await fetch(`/api/artwork/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (res.ok) setTasks(ts => ts.map(t => t.id === id ? { ...t, ...data } : t))
    setUpdating(null)
    router.refresh()
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete this artwork task?')) return
    await fetch(`/api/artwork/${id}`, { method: 'DELETE' })
    setTasks(ts => ts.filter(t => t.id !== id))
    router.refresh()
  }

  const grouped = {
    briefed: tasks.filter(t => t.status === 'briefed'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    review: tasks.filter(t => t.status === 'review'),
    revision: tasks.filter(t => t.status === 'revision'),
    approved: tasks.filter(t => t.status === 'approved'),
  }

  return (
    <div>
      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap mb-5">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <span key={key} className={`text-xs px-3 py-1 rounded-full font-medium ${cfg.color}`}>
            {grouped[key as keyof typeof grouped]?.length || 0} {cfg.label}
          </span>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-3 mb-4">
        {tasks.length === 0 && (
          <div className="text-center py-12 text-gray-600 text-sm">No artwork tasks yet. Brief the design team.</div>
        )}
        {tasks.map(task => {
          const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.briefed
          const isExpanded = expandedId === task.id
          const isMyTask = isDesign && task.assigned_to === currentUserId

          return (
            <div key={task.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {/* Header row */}
              <div
                className="flex items-center justify-between gap-3 p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : task.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{task.title}</p>
                    <p className="text-gray-500 text-xs">
                      {task.assignee?.name || 'Unassigned'}
                      {task.element?.name && ` · ${task.element.name}`}
                      {task.revision_count > 0 && ` · ${task.revision_count} revision${task.revision_count > 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {task.file_url && (
                    <a href={task.file_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      className="text-gray-500 hover:text-amber-400 transition-colors">
                      <Paperclip size={14} />
                    </a>
                  )}
                  {canBrief && (
                    <button onClick={e => { e.stopPropagation(); deleteTask(task.id) }}
                      className="text-gray-700 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded details + actions */}
              {isExpanded && (
                <div className="border-t border-gray-800 p-4 space-y-3">
                  {task.brief && (
                    <p className="text-gray-400 text-sm">{task.brief}</p>
                  )}
                  {task.revision_notes && (
                    <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-3">
                      <p className="text-red-400 text-xs font-semibold mb-1">Revision Notes</p>
                      <p className="text-gray-300 text-sm">{task.revision_notes}</p>
                    </div>
                  )}

                  {/* Design team actions */}
                  {isDesign && task.assigned_to === currentUserId && (
                    <div className="space-y-2">
                      {task.status === 'briefed' && (
                        <button
                          onClick={() => patchTask(task.id, { status: 'in_progress' })}
                          disabled={updating === task.id}
                          className="w-full text-sm bg-blue-900/40 border border-blue-800/40 text-blue-400 hover:bg-blue-900/60 py-2 rounded-lg transition-colors"
                        >
                          Start Working
                        </button>
                      )}
                      {(task.status === 'in_progress' || task.status === 'revision') && (
                        <div className="space-y-2">
                          <input
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                            placeholder="File URL (Google Drive, Dropbox link)"
                            value={fileInput[task.id] || ''}
                            onChange={e => setFileInput(f => ({ ...f, [task.id]: e.target.value }))}
                          />
                          <button
                            onClick={() => patchTask(task.id, { status: 'review', file_url: fileInput[task.id] || task.file_url })}
                            disabled={updating === task.id}
                            className="w-full text-sm bg-amber-900/40 border border-amber-800/40 text-amber-400 hover:bg-amber-900/60 py-2 rounded-lg transition-colors"
                          >
                            Submit for Review
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Approve/Revision actions */}
                  {canApprove && task.status === 'review' && (
                    <div className="space-y-2">
                      <button
                        onClick={() => patchTask(task.id, { status: 'approved' })}
                        disabled={updating === task.id}
                        className="w-full text-sm bg-green-900/40 border border-green-800/40 text-green-400 hover:bg-green-900/60 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 size={14} /> Approve
                      </button>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                          placeholder="Revision notes…"
                          value={revisionInput[task.id] || ''}
                          onChange={e => setRevisionInput(r => ({ ...r, [task.id]: e.target.value }))}
                        />
                        <button
                          onClick={() => patchTask(task.id, { status: 'revision', revision_notes: revisionInput[task.id] })}
                          disabled={updating === task.id}
                          className="px-3 text-sm bg-red-900/40 border border-red-800/40 text-red-400 hover:bg-red-900/60 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <RotateCcw size={13} /> Revision
                        </button>
                      </div>
                    </div>
                  )}

                  {task.status === 'approved' && task.file_url && (
                    <a href={task.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors">
                      <Paperclip size={14} /> View Final File
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add form — brief a new task */}
      {canBrief && (
        <>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Plus size={16} /> Brief New Artwork Task
            </button>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-white text-sm font-semibold">New Artwork Task</p>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                placeholder="Title (e.g. Stage Backdrop Design)"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
                placeholder="Brief — dimensions, theme, content, references…"
                rows={3}
                value={form.brief}
                onChange={e => setForm(f => ({ ...f, brief: e.target.value }))}
              />
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                value={form.assigned_to}
                onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
              >
                <option value="">Assign to designer (optional)</option>
                {designers.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {elements.length > 0 && (
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                  value={form.element_id}
                  onChange={e => setForm(f => ({ ...f, element_id: e.target.value }))}
                >
                  <option value="">Link to element (optional)</option>
                  {elements.map((el: any) => (
                    <option key={el.id} value={el.id}>{el.name}</option>
                  ))}
                </select>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={addTask}
                  disabled={loading}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating…' : 'Create Task'}
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
