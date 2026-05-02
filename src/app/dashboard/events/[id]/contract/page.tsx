import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['director', 'accounts'].includes(profile.role)) redirect('/dashboard')

  const [{ data: event }, { data: payments }, { data: elements }] = await Promise.all([
    supabase.from('events').select('*, clients(*)').eq('id', id).single(),
    supabase.from('payments').select('*').eq('event_id', id).order('due_date'),
    supabase.from('elements').select('name, specs, size, quantity, client_rate').eq('event_id', id).neq('status', 'cancelled'),
  ])

  if (!event) notFound()

  const ev = event as any
  const client = ev.clients || {}
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const contractNumber = `CEE/AGR/${ev.id.slice(0, 6).toUpperCase()}`
  const totalClientValue = (elements || []).reduce((s, e) => s + ((e.client_rate || 0) * (e.quantity || 1)), 0)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Controls */}
      <div className="mb-5 flex items-center justify-between print:hidden">
        <div>
          <Link href={`/dashboard/events/${id}`} className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm transition-colors">
            <ArrowLeft size={14} /> {ev.name}
          </Link>
          <h1 className="text-white text-2xl font-bold mt-1">Client Agreement</h1>
        </div>
        <button
          onClick={undefined}
          id="print-btn"
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          <Printer size={14} /> Print / PDF
        </button>
      </div>

      {/* Print button script */}
      <script dangerouslySetInnerHTML={{ __html: `
        document.addEventListener('DOMContentLoaded', () => {
          const btn = document.getElementById('print-btn');
          if (btn) btn.addEventListener('click', () => window.print());
        });
      `}} />

      {/* Agreement Document */}
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden text-gray-900 print:shadow-none print:rounded-none">
        {/* Letterhead */}
        <div className="bg-gray-950 px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                <span className="text-sm font-black text-black">CE</span>
              </div>
              <div>
                <p className="text-white font-bold text-lg">Creative Era Events</p>
                <p className="text-gray-400 text-xs">creativeeraevents@gmail.com · +91 86023 71023</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-amber-400 font-bold text-xl">EVENT AGREEMENT</p>
              <p className="text-gray-400 text-xs mt-1">#{contractNumber}</p>
              <p className="text-gray-500 text-xs">Date: {today}</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6">
          {/* Parties */}
          <div className="grid grid-cols-2 gap-8 mb-6 pb-6 border-b border-gray-200">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Service Provider</p>
              <p className="font-bold text-gray-900">Creative Era Events</p>
              <p className="text-gray-600 text-sm">creativeeraevents@gmail.com</p>
              <p className="text-gray-600 text-sm">+91 86023 71023</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Client</p>
              <p className="font-bold text-gray-900">{client.name || 'Client'}</p>
              {client.contact_name && <p className="text-gray-600 text-sm">{client.contact_name}</p>}
              {client.contact_phone && <p className="text-gray-600 text-sm">{client.contact_phone}</p>}
              {client.contact_email && <p className="text-gray-600 text-sm">{client.contact_email}</p>}
              {client.work_order_number && <p className="text-gray-500 text-xs mt-1">WO#: {client.work_order_number}</p>}
            </div>
          </div>

          {/* Event Details */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Event Details</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Event Name</p>
                <p className="font-semibold text-gray-900">{ev.name}</p>
              </div>
              {ev.event_date && (
                <div>
                  <p className="text-gray-500 text-xs">Event Date</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(ev.event_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}
              {ev.venue && (
                <div>
                  <p className="text-gray-500 text-xs">Venue</p>
                  <p className="font-semibold text-gray-900">{ev.venue}{ev.city ? `, ${ev.city}` : ''}</p>
                </div>
              )}
              {ev.type && (
                <div>
                  <p className="text-gray-500 text-xs">Event Type</p>
                  <p className="font-semibold text-gray-900 capitalize">{ev.type}</p>
                </div>
              )}
            </div>
          </div>

          {/* Scope of Work */}
          {(elements || []).length > 0 && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Scope of Work</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 text-xs text-gray-600 uppercase tracking-wider">
                    <th className="text-left px-3 py-2 rounded-tl-lg">Item</th>
                    <th className="text-left px-3 py-2">Specs / Size</th>
                    <th className="text-center px-3 py-2">Qty</th>
                    <th className="text-right px-3 py-2 rounded-tr-lg">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(elements as any[]).map((el, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-3 py-2.5 font-medium text-gray-900">{el.name}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{[el.specs, el.size].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="px-3 py-2.5 text-center text-gray-700">{el.quantity}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">
                        {el.client_rate ? `₹${(el.client_rate * el.quantity).toLocaleString('en-IN')}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totalClientValue > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={3} className="px-3 py-2.5 font-bold text-gray-900 text-right">Total</td>
                      <td className="px-3 py-2.5 font-bold text-amber-600 text-right">
                        ₹{totalClientValue.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* Payment Schedule */}
          {(payments || []).length > 0 && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Payment Schedule</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 text-xs text-gray-600 uppercase tracking-wider">
                    <th className="text-left px-3 py-2 rounded-tl-lg">Type</th>
                    <th className="text-left px-3 py-2">Due Date</th>
                    <th className="text-right px-3 py-2">Amount</th>
                    <th className="text-right px-3 py-2 rounded-tr-lg">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(payments as any[]).map((p, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-3 py-2.5 font-medium capitalize text-gray-900">{p.type}</td>
                      <td className="px-3 py-2.5 text-gray-500">
                        {p.due_date ? new Date(p.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900">₹{p.amount.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                          p.status === 'received' ? 'bg-green-100 text-green-700' :
                          p.status === 'overdue' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Terms & Conditions */}
          <div className="mb-8">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Terms & Conditions</p>
            <ol className="text-xs text-gray-600 space-y-2 list-decimal pl-4">
              <li>The scope of work is as described above. Any changes after confirmation will be billed separately.</li>
              <li>Payment as per the schedule above. Delayed payments may attract a penalty of 2% per month.</li>
              <li>Creative Era Events shall not be liable for delays caused by force majeure, venue issues, or client delays.</li>
              <li>Cancellation within 7 days of event date will forfeit 100% of advance payment.</li>
              <li>Client is responsible for obtaining necessary venue permissions and NOCs.</li>
              <li>Creative Era Events retains rights to use event photographs for portfolio and marketing purposes.</li>
              <li>Any disputes shall be subject to the jurisdiction of courts in the applicable city.</li>
            </ol>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8">
            <div className="pt-8 border-t-2 border-gray-300">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">For Creative Era Events</p>
              <p className="text-gray-900 font-semibold mt-6">Authorised Signatory</p>
              <p className="text-gray-500 text-xs">Name & Designation</p>
              <p className="text-gray-500 text-xs mt-3">Date: ________________</p>
            </div>
            <div className="pt-8 border-t-2 border-gray-300">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">For {client.name || 'Client'}</p>
              <p className="text-gray-900 font-semibold mt-6">Authorised Signatory</p>
              <p className="text-gray-500 text-xs">Name, Designation & Stamp</p>
              <p className="text-gray-500 text-xs mt-3">Date: ________________</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-xs text-gray-400">Creative Era Events · creativeeraevents@gmail.com</p>
          <p className="text-xs text-gray-400">#{contractNumber}</p>
        </div>
      </div>
    </div>
  )
}
