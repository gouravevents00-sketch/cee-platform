'use client'

import { useState } from 'react'
import { Link2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  eventId: string
  clientName?: string
  clientPhone?: string
  clientEmail?: string
  eventType?: string
  eventDate?: string
  city?: string
}

export default function BriefLinkGenerator({ eventId, clientName, clientPhone, clientEmail, eventType, eventDate, city }: Props) {
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  async function generate() {
    setGenerating(true)
    const res = await fetch('/api/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        client_name: clientName || '',
        client_phone: clientPhone || '',
        client_email: clientEmail || '',
        event_type: eventType || '',
        event_date: eventDate || '',
        city: city || '',
      }),
    })
    const data = await res.json()
    if (data.link) setLink(data.link)
    setGenerating(false)
  }

  async function copy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-800">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-amber-400 transition-colors"
      >
        <Link2 size={12} />
        Generate Client Brief Link
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-gray-600 text-xs">
            Share this link with the client — they fill their event brief and it comes straight into the quotation builder.
          </p>

          {!link ? (
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-xs font-bold px-4 py-2 rounded-xl transition-colors"
            >
              <Link2 size={12} />
              {generating ? 'Generating…' : 'Generate Link'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-300 text-xs focus:outline-none select-all"
                onFocus={e => e.target.select()}
              />
              <button
                onClick={copy}
                className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-2 rounded-xl transition-colors flex-shrink-0"
              >
                {copied ? <><Check size={11} className="text-green-400" /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
          )}

          {link && (
            <p className="text-gray-600 text-xs">
              Send via WhatsApp or email. Client fills in 3 steps — their brief comes into your quotation builder automatically.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
