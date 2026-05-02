'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Send, X, Paperclip } from 'lucide-react'

interface Props {
  eventId: string
  taskId?: string
  userId: string
}

export default function RequestApprovalButton({ eventId, taskId, userId }: Props) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('')
  const [comment, setComment] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!type) return
    setLoading(true)

    let attachment_url: string | null = null

    // Upload file if attached
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `approvals/${eventId}/${Date.now()}.${ext}`
      const { data: upload } = await supabase.storage.from('cee-files').upload(path, file)
      if (upload) {
        const { data: urlData } = supabase.storage.from('cee-files').getPublicUrl(path)
        attachment_url = urlData.publicUrl
      }
    }

    await supabase.from('approvals').insert({
      event_id: eventId,
      task_id: taskId || null,
      type,
      requested_by: userId,
      attachment_url,
      comment: comment || null,
      status: 'pending',
    })

    setOpen(false)
    setType('')
    setComment('')
    setFile(null)
    router.refresh()
    setLoading(false)
  }

  const APPROVAL_TYPES = [
    'Element Sheet Approval',
    'Layout Mockup Approval',
    'Artwork / Creative Approval',
    'Print Approval',
    'Additional Element Request',
    'Advance Request',
    'Other',
  ]

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-700/40 text-amber-400 font-medium px-4 py-2.5 rounded-xl text-sm transition-colors"
      >
        <Send size={14} /> Request Approval
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Request Approval</h3>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Approval Type *</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select type...</option>
                  {APPROVAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Details / Notes</label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 resize-none placeholder-gray-600"
                  placeholder="Describe what needs approval..."
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  <Paperclip size={12} className="inline mr-1" />Attach File (optional)
                </label>
                <input
                  type="file"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none file:mr-3 file:bg-gray-700 file:text-gray-300 file:border-0 file:rounded-lg file:px-3 file:py-1 file:text-xs"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl py-2.5 text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={loading || !type} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-xl py-2.5 text-sm">
                  {loading ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
