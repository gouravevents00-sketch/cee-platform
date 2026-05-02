import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Star, Phone, Truck, ChevronRight } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  printing: 'bg-blue-900/50 text-blue-400',
  fabrication: 'bg-purple-900/50 text-purple-400',
  av: 'bg-orange-900/50 text-orange-400',
  lighting: 'bg-yellow-900/50 text-yellow-400',
  manpower: 'bg-green-900/50 text-green-400',
  transport: 'bg-pink-900/50 text-pink-400',
  catering: 'bg-red-900/50 text-red-400',
  other: 'bg-gray-800 text-gray-400',
}

export default async function VendorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || !['director', 'accounts'].includes(profile.role)) redirect('/dashboard')

  const { data: vendors } = await supabase
    .from('vendors')
    .select('*')
    .order('name')

  const isDirector = profile.role === 'director'

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Vendors</h1>
          <p className="text-gray-500 text-sm mt-0.5">{vendors?.length || 0} vendors</p>
        </div>
        {isDirector && (
          <Link href="/dashboard/vendors/new" className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
            <Plus size={16} /> Add Vendor
          </Link>
        )}
      </div>

      <div className="space-y-2">
        {vendors && vendors.length > 0 ? vendors.map(vendor => (
          <Link key={vendor.id} href={`/dashboard/vendors/${vendor.id}`} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl px-5 py-4 block group transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Truck size={15} className="text-gray-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold">{vendor.name}</p>
                    {vendor.category && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[vendor.category] || CATEGORY_COLORS.other}`}>
                        {vendor.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {vendor.contact_name && <span className="text-gray-500 text-xs">{vendor.contact_name}</span>}
                    {vendor.contact_phone && (
                      <span className="text-gray-500 text-xs flex items-center gap-1">
                        <Phone size={10} /> {vendor.contact_phone}
                      </span>
                    )}
                  </div>
                  {vendor.notes && <p className="text-gray-600 text-xs mt-1">{vendor.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star key={star} size={13} className={star <= vendor.reliability_score ? 'text-amber-400 fill-amber-400' : 'text-gray-700'} />
                  ))}
                </div>
                <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
            </div>
          </Link>
        )) : (
          <div className="text-center py-16">
            <Truck size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No vendors added yet</p>
            {isDirector && (
              <Link href="/dashboard/vendors/new" className="text-amber-500 text-sm mt-2 inline-block hover:text-amber-400">
                + Add your first vendor
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
