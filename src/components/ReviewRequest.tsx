'use client'

import { useState } from 'react'
import { Star, Copy, Check, MessageCircle, ExternalLink } from 'lucide-react'

const REVIEW_LINK = 'https://g.page/r/CVqJgq6Ab9IiEAI/review'

export default function ReviewRequest({
  eventName,
  clientName,
}: {
  eventName: string
  clientName?: string
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<'whatsapp' | 'email' | null>(null)

  const greeting = clientName ? `Hi ${clientName},` : 'Hi,'

  const whatsappMsg = `${greeting}

Thank you for choosing Creative Era Events for *${eventName}*! It was truly a pleasure working with you.

We would really appreciate it if you could share your experience with us on Google — it takes less than a minute and means a lot to our team 🙏

👉 ${REVIEW_LINK}

Thank you!
Gourav Maheshwari
Creative Era Events | +91 86023 71023`

  const emailMsg = `${greeting}

Thank you for choosing Creative Era Events for "${eventName}"! It was truly a pleasure working with you.

We would really appreciate it if you could take a moment to share your experience on Google — it helps us grow and serve you better.

Leave us a review here: ${REVIEW_LINK}

Thank you for your time!

Warm regards,
Gourav Maheshwari
Creative Era Events
+91 86023 71023 | creativeeraevents@gmail.com`

  function copy(type: 'whatsapp' | 'email') {
    navigator.clipboard.writeText(type === 'whatsapp' ? whatsappMsg : emailMsg)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm bg-amber-500/10 hover:bg-amber-500/20 border border-amber-700/40 text-amber-400 px-4 py-2.5 rounded-xl transition-colors w-full"
      >
        <Star size={14} className="fill-amber-400" />
        {open ? 'Hide Review Request' : 'Send Google Review Request'}
      </button>

      {open && (
        <div className="mt-3 bg-gray-900 border border-amber-700/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-white font-semibold text-sm">Google Review Request</p>
            <a
              href={REVIEW_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              <ExternalLink size={12} /> Open Review Page
            </a>
          </div>

          {/* WhatsApp Template */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                <MessageCircle size={12} /> WhatsApp
              </span>
              <button
                onClick={() => copy('whatsapp')}
                className="flex items-center gap-1 text-xs bg-green-950 hover:bg-green-900 text-green-400 px-3 py-1.5 rounded-lg transition-colors"
              >
                {copied === 'whatsapp' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
            <pre className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-gray-950 border border-gray-800 rounded-xl p-3">
              {whatsappMsg}
            </pre>
          </div>

          {/* Email Template */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-blue-400 font-medium">Email</span>
              <button
                onClick={() => copy('email')}
                className="flex items-center gap-1 text-xs bg-blue-950 hover:bg-blue-900 text-blue-400 px-3 py-1.5 rounded-lg transition-colors"
              >
                {copied === 'email' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
            <pre className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-gray-950 border border-gray-800 rounded-xl p-3">
              {emailMsg}
            </pre>
          </div>

          <p className="text-gray-600 text-xs">
            Review link: <span className="text-gray-500 select-all">{REVIEW_LINK}</span>
          </p>
        </div>
      )}
    </div>
  )
}
