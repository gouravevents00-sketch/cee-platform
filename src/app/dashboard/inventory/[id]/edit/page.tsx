import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import InventoryForm from '../../InventoryForm'
import { InventoryItem } from '@/lib/types'

export default async function EditInventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  if (profile.role !== 'director' && profile.role !== 'admin') redirect('/dashboard/inventory')

  const { data: item } = await supabase.from('inventory_items').select('*').eq('id', id).single()
  if (!item) notFound()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/dashboard/inventory/${id}`} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-white text-2xl font-bold">Edit Item</h1>
          <p className="text-gray-500 text-sm mt-0.5">{item.name}</p>
        </div>
      </div>
      <InventoryForm userId={user.id} existing={item as InventoryItem} />
    </div>
  )
}
