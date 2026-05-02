import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Building2, Phone, Mail, ChevronRight } from 'lucide-react'

const CLIENT_TYPE_COLORS: Record<string, string> = {
  agency: 'bg-blue-900/50 text-blue-400',
  corporate: 'bg-purple-900/50 text-purple-400',
  government: 'bg-green-900/50 text-green-400',
  individual: 'bg-gray-800 text-gray-400',
}

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['director', 'accounts', 'admin'].includes(profile.role)) redirect('/dashboard')

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('name')

  const isDirector = profile.role === 'director'

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">{clients?.length || 0} clients</p>
        </div>
        {isDirector && (
          <Link
            href="/dashboard/clients/new"
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            <Plus size={16} /> Add Client
          </Link>
        )}
      </div>

      <div className="space-y-2">
        {clients && clients.length > 0 ? clients.map(client => (
          <Link key={client.id} href={`/dashboard/clients/${client.id}`} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl px-5 py-4 block group transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Building2 size={16} className="text-gray-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold">{client.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CLIENT_TYPE_COLORS[client.type]}`}>
                      {client.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {client.contact_name && (
                      <span className="text-gray-500 text-xs">{client.contact_name}</span>
                    )}
                    {client.contact_phone && (
                      <span className="text-gray-500 text-xs flex items-center gap-1">
                        <Phone size={10} /> {client.contact_phone}
                      </span>
                    )}
                    {client.contact_email && (
                      <span className="text-gray-500 text-xs flex items-center gap-1">
                        <Mail size={10} /> {client.contact_email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-right flex-shrink-0">
                <div>
                  <p className="text-gray-400 text-xs">{client.advance_percent}% advance</p>
                  <p className="text-gray-500 text-xs mt-0.5">{client.credit_period_days} day credit</p>
                </div>
                <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
            </div>
          </Link>
        )) : (
          <div className="text-center py-16">
            <Building2 size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No clients added yet</p>
            {isDirector && (
              <Link href="/dashboard/clients/new" className="text-amber-500 text-sm mt-2 inline-block hover:text-amber-400">
                + Add your first client
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
