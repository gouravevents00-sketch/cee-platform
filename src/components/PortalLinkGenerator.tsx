'use client'

import { useState } from 'react'
import { Link2, Copy, Check, ChevronDown, ChevronUp, Users, Truck } from 'lucide-react'

interface Vendor {
  id: string
  name: string
  category?: string
}

interface Props {
  eventId: string
  clientId?: string
  vendors: Vendor[]
}

export default function PortalLinkGenerator({ eventId, clientId, vendors }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [links, setLinks] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  async function generateLink(type: 'client' | 'vendor', id?: string) {
    const key = type === 'client' ? 'client' : `vendor-${id}`
    setLoading(key)

    const body: any = { type, event_id: eventId }
    if (type === 'client' && clientId) body.client_id = clientId
    if (type === 'vendor' && id) body.vendor_id = id

    const res = await fetch('/api/portal/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.token) {
      const path = type === 'client'
        ? `/portal/client/${data.token}`
        : `/portal/vendor/${data.token}`
      setLinks(l => ({ ...l, [key]: baseUrl + path }))
    }
    setLoading(null)
  }

  function copy(key: string, url: string) {
    navigator.clipboard.writeText(url)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-4 py-2.5 rounded-xl transition-colors w-full"
      >
        <Link2 size={14} />
        {open ? 'Hide Portal Links' : 'Generate Portal Links'}
        {open ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
      </button>

      {open && (
        <div className="mt-3 bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-4">
          <p className="text-gray-500 text-xs">Generate secure links to share with client and vendors. Links are valid for 90 days.</p>

          {/* Client Link */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users size={13} className="text-blue-400" />
              <span className="text-xs font-medium text-blue-400 uppercase tracking-wide">Client Portal</span>
            </div>
            {links['client'] ? (
              <div className="flex items-center gap-2">
                <input readOnly value={links['client']}
                  className="flex-1 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none truncate" />
                <button onClick={() => copy('client', links['client'])}
                  className="flex items-center gap-1 text-xs bg-blue-950 hover:bg-blue-900 text-blue-400 px-3 py-2 rounded-lg transition-colors flex-shrink-0">
                  {copied === 'client' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
            ) : (
              <button onClick={() => generateLink('client')} disabled={loading === 'client'}
                className="w-full bg-blue-950 hover:bg-blue-900 text-blue-400 text-xs font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50">
                {loading === 'client' ? 'Generating...' : 'Generate Client Link'}
              </button>
            )}
          </div>

          {/* Vendor Links */}
          {vendors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Truck size={13} className="text-orange-400" />
                <span className="text-xs font-medium text-orange-400 uppercase tracking-wide">Vendor Portals</span>
              </div>
              <div className="space-y-2">
                {vendors.map(vendor => {
                  const key = `vendor-${vendor.id}`
                  return (
                    <div key={vendor.id}>
                      <p className="text-gray-400 text-xs mb-1.5 flex items-center gap-1">
                        {vendor.name}
                        {vendor.category && <span className="text-gray-600">· {vendor.category}</span>}
                      </p>
                      {links[key] ? (
                        <div className="flex items-center gap-2">
                          <input readOnly value={links[key]}
                            className="flex-1 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none truncate" />
                          <button onClick={() => copy(key, links[key])}
                            className="flex items-center gap-1 text-xs bg-orange-950 hover:bg-orange-900 text-orange-400 px-3 py-2 rounded-lg transition-colors flex-shrink-0">
                            {copied === key ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => generateLink('vendor', vendor.id)} disabled={loading === key}
                          className="w-full bg-orange-950 hover:bg-orange-900 text-orange-400 text-xs font-medium py-2 rounded-xl transition-colors disabled:opacity-50">
                          {loading === key ? 'Generating...' : `Generate Link — ${vendor.name}`}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
