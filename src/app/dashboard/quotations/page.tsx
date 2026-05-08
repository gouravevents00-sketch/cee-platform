import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, ExternalLink, Lock, Clock, CheckCircle2, MessageSquare, Send } from 'lucide-react'

function fmt(n: number) { return Math.round(n).toLocaleString('en-IN') }

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any }> = {
  draft:       { label: 'Draft',       cls: 'bg-gray-800 text-gray-400',         icon: FileText },
  sent:        { label: 'Sent',        cls: 'bg-blue-900/60 text-blue-400',       icon: Send },
  accepted:    { label: 'Accepted',    cls: 'bg-green-900/60 text-green-400',     icon: CheckCircle2 },
  negotiating: { label: 'Negotiating', cls: 'bg-amber-900/60 text-amber-400',     icon: MessageSquare },
  rejected:    { label: 'Rejected',    cls: 'bg-red-900/60 text-red-400',         icon: Clock },
  locked:      { label: 'Locked',      cls: 'bg-purple-900/60 text-purple-400',   icon: Lock },
}

export default async function QuotationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['director', 'accounts', 'admin'].includes(profile.role)) redirect('/dashboard')

  const { data: quotations } = await supabase
    .from('quotations')
    .select(`
      id, quote_number, status, total, subtotal, gst_amount, company,
      locked_at, created_at, updated_at,
      events!inner(id, name, event_date, clients(name))
    `)
    .order('created_at', { ascending: false })

  // Fetch latest client decisions for all quotation IDs
  const quotIds = (quotations || []).map(q => q.id)
  const { data: tokens } = quotIds.length
    ? await supabase
        .from('quotation_tokens')
        .select('quotation_id, status, client_decision, decided_at')
        .in('quotation_id', quotIds)
        .not('client_decision', 'is', null)
    : { data: [] }

  const tokenMap = new Map<string, any>()
  ;(tokens || []).forEach(t => {
    const existing = tokenMap.get(t.quotation_id)
    if (!existing || new Date(t.decided_at) > new Date(existing.decided_at)) {
      tokenMap.set(t.quotation_id, t)
    }
  })

  const rows = (quotations || []).map((q: any) => ({
    ...q,
    event: q.events,
    client: q.events?.clients,
    token: tokenMap.get(q.id),
    displayStatus: q.locked_at ? 'locked' : q.status,
  }))

  const byStatus = {
    pending: rows.filter(r => ['sent', 'negotiating'].includes(r.displayStatus)),
    accepted: rows.filter(r => r.displayStatus === 'accepted' || r.displayStatus === 'locked'),
    draft: rows.filter(r => r.displayStatus === 'draft'),
    closed: rows.filter(r => r.displayStatus === 'rejected'),
  }

  function QuoteRow({ q }: { q: any }) {
    const sc = STATUS_CONFIG[q.displayStatus] || STATUS_CONFIG.draft
    const StatusIcon = sc.icon
    return (
      <Link
        href={`/dashboard/events/${q.event?.id}/quotation`}
        className="flex items-center gap-4 bg-gray-900 hover:bg-gray-800/80 border border-gray-800 hover:border-gray-700 rounded-2xl px-5 py-4 transition-colors group"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-semibold text-sm truncate">{q.event?.name || '—'}</p>
            {q.client?.name && (
              <span className="text-gray-500 text-xs">· {q.client.name}</span>
            )}
            {q.token?.client_decision && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                q.token.client_decision === 'accepted' ? 'bg-green-900/60 text-green-400' : 'bg-blue-900/60 text-blue-400'
              }`}>
                {q.token.client_decision === 'accepted' ? 'Client ✓ Accepted' : 'Client: Changes requested'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-gray-500 text-xs">{q.quote_number || q.id.slice(0, 8)}</span>
            {q.event?.event_date && (
              <span className="text-gray-600 text-xs">
                Event: {new Date(q.event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
            <span className="text-gray-600 text-xs">
              Updated {new Date(q.updated_at || q.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {q.total > 0 && (
            <div className="text-right">
              <p className="text-white font-bold text-sm">₹{fmt(q.total)}</p>
              <p className="text-gray-600 text-xs">{q.company === 'cex' ? 'CEX' : 'CEE'}</p>
            </div>
          )}
          <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${sc.cls}`}>
            <StatusIcon size={11} />
            {sc.label}
          </span>
          <ExternalLink size={14} className="text-gray-700 group-hover:text-gray-400 transition-colors" />
        </div>
      </Link>
    )
  }

  function Section({ title, items, emptyMsg }: { title: string; items: any[]; emptyMsg: string }) {
    return (
      <div>
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3 px-1">{title} ({items.length})</h2>
        {items.length === 0
          ? <p className="text-gray-700 text-sm px-1">{emptyMsg}</p>
          : <div className="space-y-2">{items.map(q => <QuoteRow key={q.id} q={q} />)}</div>}
      </div>
    )
  }

  const totalValue = rows.filter(r => r.displayStatus !== 'rejected').reduce((s, r) => s + (r.total || 0), 0)
  const acceptedValue = byStatus.accepted.reduce((s, r) => s + (r.total || 0), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-white text-2xl font-bold">Quotations</h1>
        <p className="text-gray-500 text-sm mt-1">All quotations across events</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Pipeline', value: `₹${fmt(totalValue)}`, sub: `${rows.length} quotations` },
          { label: 'Accepted / Locked', value: `₹${fmt(acceptedValue)}`, sub: `${byStatus.accepted.length} events` },
          { label: 'Awaiting Response', value: byStatus.pending.length.toString(), sub: 'sent / negotiating' },
          { label: 'Drafts', value: byStatus.draft.length.toString(), sub: 'not yet sent' },
        ].map(card => (
          <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-4">
            <p className="text-gray-500 text-xs">{card.label}</p>
            <p className="text-white text-xl font-bold mt-1">{card.value}</p>
            <p className="text-gray-600 text-xs mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-8">
        <Section title="Awaiting Client Response" items={byStatus.pending} emptyMsg="No quotations waiting for response" />
        <Section title="Accepted / Locked" items={byStatus.accepted} emptyMsg="No accepted quotations yet" />
        <Section title="Drafts" items={byStatus.draft} emptyMsg="No drafts" />
        {byStatus.closed.length > 0 && (
          <Section title="Rejected" items={byStatus.closed} emptyMsg="" />
        )}
      </div>
    </div>
  )
}
