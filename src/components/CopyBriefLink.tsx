'use client'

import { useState } from 'react'
import { Copy, Check, Link2 } from 'lucide-react'

export default function CopyBriefLink() {
  const [copied, setCopied] = useState(false)

  function copy() {
    const url = `${window.location.origin}/brief`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <button
      onClick={copy}
      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
        copied
          ? 'bg-green-950/50 border-green-700/50 text-green-400'
          : 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/60'
      }`}
    >
      {copied ? <Check size={15} /> : <Link2 size={15} />}
      {copied ? 'Link copied — paste in WhatsApp' : 'Send Brief Link to Client'}
    </button>
  )
}
