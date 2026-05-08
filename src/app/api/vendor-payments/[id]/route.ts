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

  const ct = req.headers.get('content-type') || ''

  // Invoice upload (accounts)
  if (ct.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
    const path = `${id}/${Date.now()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('vendor-invoices')
      .upload(path, arrayBuffer, { contentType: file.type })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: publicData } = supabase.storage.from('vendor-invoices').getPublicUrl(path)

    const { error } = await supabase.from('vendor_payments').update({
      invoice_received: true,
      invoice_url: publicData.publicUrl,
      invoice_received_at: new Date().toISOString(),
      status: 'invoice_received',
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notify directors that invoice is in
    const { data: payment } = await supabase
      .from('vendor_payments')
      .select('amount, vendors(name), events(name)')
      .eq('id', id)
      .single() as any

    const { data: directors } = await supabase.from('profiles').select('id').eq('role', 'director')
    if (directors && directors.length > 0) {
      await supabase.from('notifications').insert(
        directors.map((d: any) => ({
          user_id: d.id,
          title: 'Vendor Invoice Received',
          body: `Invoice uploaded for ${payment?.vendors?.name || 'vendor'} — ₹${payment?.amount?.toLocaleString('en-IN') || ''} (${payment?.events?.name || 'event'}). Ready to release payment.`,
          link: `/dashboard/events/${payment?.events?.id || ''}/payments`,
        }))
      )
    }

    return NextResponse.json({ ok: true, invoice_url: publicData.publicUrl })
  }

  // JSON update — status change / payment release
  const body = await req.json()
  const { status, paid_date, notes } = body

  // Only director can release payment
  if ((status === 'paid' || body.release_payment) && profile.role !== 'director') {
    return NextResponse.json({ error: 'Only directors can release payments' }, { status: 403 })
  }

  const update: Record<string, any> = {}
  if (status) update.status = status
  if (paid_date) update.paid_date = paid_date
  if (notes !== undefined) update.notes = notes
  if (status === 'paid') {
    update.paid_date = paid_date || new Date().toISOString().split('T')[0]
    update.payment_released_at = new Date().toISOString()
  }

  const { error } = await supabase.from('vendor_payments').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
