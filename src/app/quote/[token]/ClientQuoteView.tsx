'use client'

import { useState } from 'react'
import { CheckCircle2, MessageSquare, Download } from 'lucide-react'

function fmt(n: number) { return Math.round(n).toLocaleString('en-IN') }

function numToWords(n: number): string {
  if (n <= 0) return ''
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  function b100(x: number): string { return x < 20 ? ones[x] : tens[Math.floor(x/10)] + (x%10 ? ' '+ones[x%10] : '') }
  function b1k(x: number): string { return x < 100 ? b100(x) : ones[Math.floor(x/100)]+' Hundred'+(x%100?' '+b100(x%100):'') }
  let r = '', rem = n
  if (rem >= 10000000) { r += b1k(Math.floor(rem/10000000))+' Crore '; rem %= 10000000 }
  if (rem >= 100000)   { r += b1k(Math.floor(rem/100000))+' Lakh '; rem %= 100000 }
  if (rem >= 1000)     { r += b1k(Math.floor(rem/1000))+' Thousand '; rem %= 1000 }
  if (rem > 0)         { r += b1k(rem) }
  return r.trim()
}

export default function ClientQuoteView({
  token, quot, alreadyDecided, clientDecision, clientNote
}: {
  token: string
  quot: any
  alreadyDecided: boolean
  clientDecision?: string
  clientNote?: string
}) {
  const [submitting, setSubmitting] = useState(false)
  const [decision, setDecision] = useState<'accepted' | 'changes_requested' | null>(null)
  const [note, setNote] = useState('')
  const [done, setDone] = useState(alreadyDecided)
  const [itemFeedbacks, setItemFeedbacks] = useState<Record<number, { suggestedAmount: string; comment: string }>>({})

  function updateItemFeedback(idx: number, patch: Partial<{ suggestedAmount: string; comment: string }>) {
    setItemFeedbacks(prev => {
      const existing = prev[idx] || { suggestedAmount: '', comment: '' }
      return { ...prev, [idx]: { ...existing, ...patch } }
    })
  }

  const event = quot.events
  const client = event?.clients
  const items = (quot.items || []).filter((r: any) => r._type === 'item')
  const sections = quot.items || []

  const gold = '#c9a84c'
  const dark = '#1a1a2e'

  // Group items by section
  const groups: { label: string; items: any[] }[] = []
  let currentGroup: { label: string; items: any[] } = { label: '', items: [] }
  for (const row of sections) {
    if (row._type === 'section') {
      if (currentGroup.items.length || currentGroup.label) groups.push(currentGroup)
      currentGroup = { label: row.label || '', items: [] }
    } else if (row._type === 'item' && row.description?.trim()) {
      currentGroup.items.push(row)
    }
  }
  if (currentGroup.items.length || currentGroup.label) groups.push(currentGroup)
  if (!groups.length && items.length) groups.push({ label: 'Scope of Work', items })

  const subtotal = quot.subtotal || 0
  const discountAmt = quot.discount_pct > 0 ? subtotal * quot.discount_pct / 100 : 0
  const grandTotal = quot.total || 0
  const gstAmt = quot.gst_amount || 0
  const milestones = quot.payment_milestones || []
  const co = quot.company === 'cex'
    ? { name: 'CREATIVE ERA EXPERIENCES', contact: 'Indore, MP · +91 86023 71023' }
    : { name: 'CREATIVE ERA EVENTS', contact: 'Indore, Madhya Pradesh · +91 86023 71023 · creativeeraevents@gmail.com' }

  function rowAmt(r: any) {
    if (r.is_lumpsum) return r.lump_amount || 0
    const area = r.area_sqft || 0
    const m = area > 0 ? area : 1
    return (r.days || 1) * (r.qty || 1) * m * (r.rate || 0)
  }

  async function submitDecision() {
    if (!decision) return
    if (decision === 'changes_requested' && !note.trim()) return
    setSubmitting(true)
    // Build structured note for changes_requested
    let notePayload = note
    if (decision === 'changes_requested') {
      const itemsWithFeedback = Object.entries(itemFeedbacks)
        .filter(([, f]) => f.suggestedAmount || f.comment)
        .map(([idx, f]) => ({
          description: items[Number(idx)]?.description || '',
          suggestedAmount: f.suggestedAmount ? Number(f.suggestedAmount) : null,
          comment: f.comment || null,
        }))
      if (itemsWithFeedback.length > 0) {
        notePayload = JSON.stringify({ general: note, items: itemsWithFeedback })
      }
    }
    const res = await fetch(`/api/quote/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, note: notePayload }),
    })
    if (res.ok) setDone(true)
    setSubmitting(false)
  }

  if (done) {
    const wasAccepted = decision === 'accepted' || clientDecision === 'accepted'
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${wasAccepted ? 'bg-green-900/40 border border-green-800' : 'bg-blue-900/40 border border-blue-800'}`}>
            {wasAccepted ? <CheckCircle2 size={28} className="text-green-400" /> : <MessageSquare size={24} className="text-blue-400" />}
          </div>
          <h1 className="text-white text-xl font-bold mb-2">
            {wasAccepted ? 'Quotation Accepted!' : 'Changes Requested'}
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            {wasAccepted
              ? 'Thank you for accepting. Our team will reach out to you shortly to proceed.'
              : 'We have received your feedback and will revise the quotation accordingly.'}
          </p>
          {(note || clientNote) && (
            <div className="mt-4 p-3 bg-gray-900 border border-gray-800 rounded-xl text-left">
              <p className="text-gray-500 text-xs">Your note:</p>
              <p className="text-gray-300 text-sm mt-1 italic">"{note || clientNote}"</p>
            </div>
          )}
          <p className="text-gray-600 text-xs mt-6">Creative Era Events · +91 86023 71023</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#fef9f0', color: '#2d2d2d', fontFamily: "'Georgia', serif" }}>

      {/* Letterhead */}
      <div className="px-6 py-6 flex items-start justify-between" style={{ background: dark }}>
        <div>
          <p className="font-black text-base tracking-widest uppercase" style={{ color: gold }}>{co.name}</p>
          <p className="text-xs mt-2" style={{ color: '#ccc' }}>{co.contact}</p>
        </div>
        <div className="text-right">
          <p className="font-black text-xl tracking-widest" style={{ color: gold }}>QUOTATION</p>
          <div className="text-xs mt-2 space-y-0.5" style={{ color: '#ccc' }}>
            <p>No: <span className="text-white font-semibold">{quot.quote_number || '—'}</span></p>
            <p>Date: {new Date(quot.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            {quot.validity_days && (
              <p>Valid: {new Date(new Date(quot.created_at).getTime() + quot.validity_days * 86400000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            )}
          </div>
        </div>
      </div>

      {/* Client + Event */}
      <div className="grid grid-cols-1 sm:grid-cols-2 border-b-2" style={{ borderColor: '#e8d5a3', background: '#fef9f0' }}>
        <div className="px-6 py-4 border-b sm:border-b-0 sm:border-r" style={{ borderColor: '#e8d5a3' }}>
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: gold }}>Client Details</p>
          <div className="space-y-1 text-sm">
            {[
              ['Client', client?.name],
              ['Contact', client?.contact_name],
              ['Phone', client?.contact_phone],
              ['Email', client?.contact_email],
            ].filter(([, v]) => v).map(([l, v]) => (
              <div key={l} className="flex gap-3">
                <span className="w-16 flex-shrink-0 text-xs" style={{ color: '#a0875a' }}>{l}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="px-6 py-4">
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: gold }}>Event Details</p>
          <div className="space-y-1 text-sm">
            {[
              ['Event', event?.name],
              ['Date', event?.event_date ? new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null],
              ['Venue', event?.venue],
              ['City', event?.city],
            ].filter(([, v]) => v).map(([l, v]) => (
              <div key={l} className="flex gap-3">
                <span className="w-16 flex-shrink-0 text-xs" style={{ color: '#a0875a' }}>{l}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section header */}
      <div className="px-6 py-2 text-xs font-black uppercase tracking-widest" style={{ background: dark, color: gold }}>
        Scope of Work &amp; Pricing
      </div>

      {/* Items — grouped by section */}
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.label && (
            <div className="px-6 py-2" style={{ background: dark }}>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: gold }}>{group.label}</p>
            </div>
          )}
          <table className="w-full border-collapse text-sm" style={{ background: '#fef9f0' }}>
            <thead>
              <tr style={{ background: '#2d3561' }}>
                <th className="text-left px-4 py-2 text-white text-xs font-bold w-8">#</th>
                <th className="text-left px-3 py-2 text-white text-xs font-bold">Element / Item</th>
                <th className="text-left px-3 py-2 text-white text-xs font-bold hidden sm:table-cell">Specification</th>
                <th className="text-left px-3 py-2 text-white text-xs font-bold hidden sm:table-cell w-24">Dimensions</th>
                <th className="text-center px-2 py-2 text-white text-xs font-bold w-12">Days</th>
                <th className="text-center px-2 py-2 text-white text-xs font-bold w-12">Qty</th>
                <th className="text-right px-3 py-2 pr-6 text-white text-xs font-bold w-28">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((row: any, i: number) => {
                const amt = rowAmt(row)
                return (
                  <tr key={i} className="border-b" style={{ background: i % 2 === 0 ? '#fef9f0' : '#fdf3e0', borderColor: '#e8d5a3' }}>
                    <td className="px-4 py-2 text-xs text-center" style={{ color: '#a0875a' }}>{i + 1}</td>
                    <td className="px-3 py-2 font-semibold">{row.is_lumpsum && <span className="text-xs mr-1" style={{ color: '#c9a84c' }}>[LS]</span>}{row.description}</td>
                    <td className="px-3 py-2 text-xs hidden sm:table-cell" style={{ color: '#6b5b45' }}>{row.specs || '—'}</td>
                    <td className="px-3 py-2 text-xs hidden sm:table-cell" style={{ color: '#6b5b45' }}>{row.dim_str || '—'}</td>
                    <td className="px-2 py-2 text-center text-xs">{row.days || 1}</td>
                    <td className="px-2 py-2 text-center text-xs">{row.qty || 1}</td>
                    <td className="px-3 py-2 pr-6 text-right font-semibold" style={{ color: '#a0875a' }}>
                      {amt ? `₹ ${fmt(amt)}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Totals */}
      <div className="flex justify-end px-6 py-5 border-t-2" style={{ borderColor: dark, background: '#fef9f0' }}>
        <div className="w-72 space-y-1.5 text-sm">
          <div className="flex justify-between py-1 border-b" style={{ borderColor: '#e8d5a3' }}>
            <span style={{ color: '#6b5b45' }}>Subtotal</span>
            <span className="font-semibold">₹ {fmt(subtotal)}</span>
          </div>
          {discountAmt > 0 && (
            <div className="flex justify-between py-1 border-b text-red-600" style={{ borderColor: '#e8d5a3' }}>
              <span>Discount ({quot.discount_pct}%)</span>
              <span className="font-semibold">- ₹ {fmt(discountAmt)}</span>
            </div>
          )}
          {gstAmt > 0 && (
            <div className="flex justify-between py-1 border-b" style={{ borderColor: '#e8d5a3' }}>
              <span style={{ color: '#6b5b45' }}>GST 18% ({quot.gst_mode === 'exclusive' ? 'added' : 'included'})</span>
              <span className="font-semibold">₹ {fmt(gstAmt)}</span>
            </div>
          )}
          <div className="flex justify-between py-2.5 px-4 rounded-xl mt-2" style={{ background: dark }}>
            <span className="font-black uppercase tracking-wide text-xs" style={{ color: gold }}>Grand Total</span>
            <span className="font-black text-white text-lg">₹ {fmt(grandTotal)}</span>
          </div>
          {grandTotal > 0 && (
            <p className="text-right text-xs italic" style={{ color: '#a0875a' }}>
              Rupees {numToWords(Math.round(grandTotal))} Only
            </p>
          )}
        </div>
      </div>

      {/* Payment schedule */}
      {milestones.length > 0 && grandTotal > 0 && (
        <div className="px-6 py-5 border-t" style={{ borderColor: '#e8d5a3', background: '#fdf6e3' }}>
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: gold }}>Payment Schedule</p>
          <div className="space-y-1.5">
            {milestones.map((m: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span style={{ color: '#6b5b45' }}>{m.label}</span>
                <div className="flex items-center gap-4">
                  {m.due_date && <span className="text-xs" style={{ color: '#a0875a' }}>Due: {new Date(m.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                  <span className="font-semibold">₹ {fmt(grandTotal * m.percent / 100)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {quot.notes && (
        <div className="px-6 py-4 border-t text-xs" style={{ borderColor: '#e8d5a3', background: '#fdf6e3', color: '#6b5b45', whiteSpace: 'pre-wrap' }}>
          <p className="font-black uppercase tracking-widest mb-2 text-xs" style={{ color: '#a0875a' }}>Notes / Terms</p>
          {quot.notes}
        </div>
      )}

      {/* ── CLIENT DECISION PANEL ── */}
      <div className="sticky bottom-0 border-t-2 px-4 py-4 sm:px-6 print:hidden" style={{ borderColor: dark, background: '#fef9f0' }}>
        {!decision ? (
          <div className="max-w-xl mx-auto space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setDecision('accepted')}
                className="flex-1 flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl text-sm transition-colors"
                style={{ background: '#16a34a', color: 'white' }}
              >
                <CheckCircle2 size={16} /> Accept Quotation
              </button>
              <button
                onClick={() => setDecision('changes_requested')}
                className="flex-1 flex items-center justify-center gap-2 font-semibold py-3.5 rounded-2xl text-sm border-2 transition-colors"
                style={{ borderColor: dark, color: dark, background: 'transparent' }}
              >
                <MessageSquare size={15} /> Request Changes
              </button>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border transition-colors"
                style={{ borderColor: '#e8d5a3', color: '#a0875a', background: 'transparent' }}
              >
                <Download size={12} /> Download PDF
              </button>
            </div>
          </div>
        ) : decision === 'accepted' ? (
          <div className="max-w-xl mx-auto space-y-3">
            <div className="p-3 rounded-xl border-2 text-sm text-center font-semibold" style={{ borderColor: '#16a34a', color: '#16a34a', background: '#f0fdf4' }}>
              ✓ You are accepting this quotation
            </div>
            <div className="flex gap-2">
              <button onClick={submitDecision} disabled={submitting}
                className="flex-1 font-bold py-3 rounded-2xl text-sm text-white transition-colors disabled:opacity-50"
                style={{ background: '#16a34a' }}>
                {submitting ? 'Confirming…' : 'Confirm Accept'}
              </button>
              <button onClick={() => setDecision(null)}
                className="px-5 py-3 rounded-2xl text-sm font-medium border" style={{ borderColor: '#e8d5a3', color: '#6b5b45' }}>
                Back
              </button>
            </div>
          </div>
        ) : (
          // changes_requested — per-item feedback + general note
          <div className="max-w-2xl mx-auto space-y-3 max-h-[60vh] overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#a0875a' }}>
              Suggest changes per item (optional) + add a note below
            </p>
            {items.filter((r: any) => r.description?.trim()).map((r: any, idx: number) => {
              const fb = itemFeedbacks[idx] || { suggestedAmount: '', comment: '' }
              const amt = rowAmt(r)
              return (
                <div key={idx} className="rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: '#e8d5a3', background: '#fdf6e3' }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-sm" style={{ color: '#2d2d2d' }}>{r.description}</p>
                    {amt > 0 && <p className="text-xs flex-shrink-0" style={{ color: '#a0875a' }}>₹{Math.round(amt).toLocaleString('en-IN')}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={fb.suggestedAmount}
                      onChange={e => updateItemFeedback(idx, { suggestedAmount: e.target.value })}
                      placeholder="Suggested amount (₹)"
                      className="border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                      style={{ borderColor: '#e8d5a3', background: '#fef9f0', color: '#2d2d2d' }}
                    />
                    <input
                      type="text"
                      value={fb.comment}
                      onChange={e => updateItemFeedback(idx, { comment: e.target.value })}
                      placeholder="Comment (optional)"
                      className="border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                      style={{ borderColor: '#e8d5a3', background: '#fef9f0', color: '#2d2d2d' }}
                    />
                  </div>
                </div>
              )
            })}
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Overall feedback / changes needed (required)…"
              className="w-full border-2 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none"
              style={{ borderColor: '#e8d5a3', background: '#fef9f0', color: '#2d2d2d', fontFamily: 'inherit' }}
            />
            <div className="flex gap-2">
              <button onClick={submitDecision} disabled={submitting || !note.trim()}
                className="flex-1 font-bold py-3 rounded-2xl text-sm text-white transition-colors disabled:opacity-50"
                style={{ background: '#1a1a2e' }}>
                {submitting ? 'Sending…' : 'Send Feedback'}
              </button>
              <button onClick={() => setDecision(null)}
                className="px-5 py-3 rounded-2xl text-sm font-medium border" style={{ borderColor: '#e8d5a3', color: '#6b5b45' }}>
                Back
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 text-center" style={{ background: dark }}>
        <p className="text-xs" style={{ color: '#888' }}>{co.name} · creativeeraevents@gmail.com · +91 86023 71023 · Indore, MP</p>
      </div>
    </div>
  )
}
