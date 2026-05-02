import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { INVENTORY_CATEGORY_COLORS, INVENTORY_CATEGORY_LABELS, InventoryCategory } from '@/lib/types'
import QtyUpdater from './QtyUpdater'
import DeleteButton from './DeleteButton'

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: item } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', id)
    .single()

  if (!item) notFound()

  const canEdit = profile.role === 'director' || profile.role === 'admin'

  const deployedQty = item.qty_total - item.qty_available
  const deployedPercent = item.qty_total > 0 ? Math.round((deployedQty / item.qty_total) * 100) : 0

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/inventory" className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-white text-2xl font-bold">{item.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INVENTORY_CATEGORY_COLORS[item.category as InventoryCategory]}`}>
              {INVENTORY_CATEGORY_LABELS[item.category as InventoryCategory]}
            </span>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/inventory/${id}/edit`}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-4 py-2.5 rounded-xl text-sm transition-colors">
              <Pencil size={14} />
              Edit
            </Link>
            <DeleteButton itemId={id} itemName={item.name} />
          </div>
        )}
      </div>

      {/* Image */}
      {item.image_url && (
        <div className="mb-4">
          <img src={item.image_url} alt={item.name}
            className="w-full max-h-64 object-cover rounded-2xl bg-gray-800" />
        </div>
      )}

      {/* Qty Overview */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-amber-400 text-3xl font-bold">{item.qty_available}</p>
            <p className="text-gray-500 text-xs mt-0.5">Available</p>
          </div>
          <div className="text-center border-x border-gray-800">
            <p className="text-white text-3xl font-bold">{deployedQty}</p>
            <p className="text-gray-500 text-xs mt-0.5">Deployed</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-3xl font-bold">{item.qty_total}</p>
            <p className="text-gray-500 text-xs mt-0.5">Total</p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>{deployedPercent}% deployed</span>
            <span>{item.unit}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${deployedPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Details</h2>
        <div className="space-y-3">
          {item.color && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Colour / Finish</span>
              <span className="text-white text-sm font-medium">{item.color}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Unit</span>
            <span className="text-white text-sm font-medium capitalize">{item.unit}</span>
          </div>
          {item.description && (
            <div>
              <p className="text-gray-500 text-sm mb-1">Description</p>
              <p className="text-gray-300 text-sm leading-relaxed">{item.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Qty Update */}
      {canEdit && (
        <QtyUpdater
          itemId={item.id}
          qtyTotal={item.qty_total}
          qtyAvailable={item.qty_available}
          unit={item.unit}
        />
      )}
    </div>
  )
}
