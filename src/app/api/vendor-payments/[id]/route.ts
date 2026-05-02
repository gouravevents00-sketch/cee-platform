import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['director', 'accounts'].includes(profile.role)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const body = await req.json()
  const { status, paid_date, notes } = body

  const update: Record<string, any> = { status }
  if (paid_date) update.paid_date = paid_date
  if (notes !== undefined) update.notes = notes

  const { error } = await supabase.from('vendor_payments').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
