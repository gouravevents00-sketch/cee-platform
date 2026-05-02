'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { InventoryCategory, InventoryItem } from '@/lib/types'

interface Props {
  userId: string
  existing?: InventoryItem
}

export default function InventoryForm({ userId, existing }: Props) {
  const router = useRouter()
  const isEdit = !!existing

  const [name, setName] = useState(existing?.name || '')
  const [category, setCategory] = useState<InventoryCategory>(existing?.category || 'production')
  const [description, setDescription] = useState(existing?.description || '')
  const [color, setColor] = useState(existing?.color || '')
  const [qtyTotal, setQtyTotal] = useState(existing?.qty_total?.toString() || '')
  const [qtyAvailable, setQtyAvailable] = useState(existing?.qty_available?.toString() || '')
  const [unit, setUnit] = useState(existing?.unit || 'nos')
  const [imageUrl, setImageUrl] = useState(existing?.image_url || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = {
        name,
        category,
        description: description || null,
        color: color || null,
        qty_total: parseInt(qtyTotal) || 0,
        qty_available: parseInt(qtyAvailable) || 0,
        unit,
        image_url: imageUrl || null,
        ...(!isEdit && { created_by: userId }),
      }

      const url = isEdit ? `/api/inventory/${existing!.id}` : '/api/inventory'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to save')
      }

      const data = await res.json()
      router.push(`/dashboard/inventory/${isEdit ? existing!.id : data.id}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Basic Info */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-4">Item Details</h2>
        <div className="space-y-3">
          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1.5">Item Name *</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Eg. Queue Manager, Barrier, Podium"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
          </div>

          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1.5">Category *</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'production', label: 'Production House' },
                { id: 'experiences', label: 'Experiences' },
                { id: 'general', label: 'General' },
              ] as { id: InventoryCategory; label: string }[]).map(c => (
                <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                  className={`py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                    category === c.id ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Details about the item — type, finish, features..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Colour / Finish</label>
              <input type="text" value={color} onChange={e => setColor(e.target.value)}
                placeholder="Eg. Black, Silver, Red"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">Unit</label>
              <select value={unit} onChange={e => setUnit(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500">
                <option value="nos">Nos</option>
                <option value="set">Set</option>
                <option value="piece">Piece</option>
                <option value="meter">Meter</option>
                <option value="sqft">Sq. Ft.</option>
                <option value="kg">Kg</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Quantity */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-4">Quantity</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1.5">Total Qty *</label>
            <input required type="number" min={0} value={qtyTotal} onChange={e => setQtyTotal(e.target.value)}
              placeholder="Eg. 150"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            <p className="text-gray-600 text-xs mt-1">Total owned</p>
          </div>
          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1.5">Available Qty *</label>
            <input required type="number" min={0} value={qtyAvailable} onChange={e => setQtyAvailable(e.target.value)}
              placeholder="Eg. 120"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
            <p className="text-gray-600 text-xs mt-1">Currently free</p>
          </div>
        </div>
      </div>

      {/* Image */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-4">Image</h2>
        <div>
          <label className="text-gray-400 text-xs font-medium block mb-1.5">Image URL</label>
          <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
            placeholder="Paste image link (Google Drive, Dropbox, etc.)"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder-gray-600" />
          <p className="text-gray-600 text-xs mt-1.5">Tip: Upload to Google Drive → share → copy link</p>
        </div>
        {imageUrl && (
          <div className="mt-3">
            <img src={imageUrl} alt="Preview" className="w-full max-h-40 object-cover rounded-xl bg-gray-800" />
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="flex items-center gap-3 pb-6">
        <button type="button" onClick={() => router.back()}
          className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-xl text-sm transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-xl text-sm transition-colors">
          {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Item'}
        </button>
      </div>
    </form>
  )
}
