import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { INVENTORY_CATEGORY_COLORS, INVENTORY_CATEGORY_LABELS, InventoryCategory } from '@/lib/types'

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const isDirector = profile.role === 'director'
  const canEdit = profile.role === 'director' || profile.role === 'admin'

  const { data: items } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name')

  const grouped = {
    experiences: items?.filter(i => i.category === 'experiences') || [],
    production: items?.filter(i => i.category === 'production') || [],
    general: items?.filter(i => i.category === 'general') || [],
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Inventory</h1>
          <p className="text-gray-500 text-sm mt-0.5">{items?.length || 0} items tracked</p>
        </div>
        {canEdit && (
          <Link
            href="/dashboard/inventory/new"
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            <Plus size={16} />
            Add Item
          </Link>
        )}
      </div>

      {items?.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-500">No inventory items yet</p>
          {canEdit && (
            <Link href="/dashboard/inventory/new" className="text-amber-500 text-sm mt-2 inline-block hover:text-amber-400">
              + Add first item
            </Link>
          )}
        </div>
      )}

      {(['experiences', 'production', 'general'] as InventoryCategory[]).map(cat => {
        const catItems = grouped[cat]
        if (catItems.length === 0) return null
        return (
          <div key={cat} className="mb-8">
            <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
              {INVENTORY_CATEGORY_LABELS[cat]}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {catItems.map((item: any) => (
                <Link
                  key={item.id}
                  href={`/dashboard/inventory/${item.id}`}
                  className="block bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition-colors"
                >
                  <div className="flex gap-4">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-gray-800"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-600 text-xl font-bold">{item.name[0]}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-white font-semibold text-sm">{item.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${INVENTORY_CATEGORY_COLORS[item.category as InventoryCategory]}`}>
                          {INVENTORY_CATEGORY_LABELS[item.category as InventoryCategory]}
                        </span>
                      </div>
                      {item.color && (
                        <p className="text-gray-500 text-xs mt-0.5">Colour: {item.color}</p>
                      )}
                      {item.description && (
                        <p className="text-gray-600 text-xs mt-0.5 truncate">{item.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${item.qty_available > 0 ? 'bg-green-400' : 'bg-red-400'}`} />
                          <span className="text-white text-xs font-semibold">{item.qty_available}</span>
                          <span className="text-gray-600 text-xs">/ {item.qty_total} {item.unit} available</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
