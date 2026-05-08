import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const { name, phone, event_name, filter_used, result_url, rating } = await req.json()

  if (!name || !phone) {
    return NextResponse.json({ error: 'name and phone are required' }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('booth_leads').insert({
      name: name.trim(),
      phone: phone.trim(),
      event_name: event_name || null,
      filter_used: filter_used || null,
      result_url: result_url || null,
      rating: rating || null,
    })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    // Log but don't block the user — lead save failure shouldn't stop photo download
    console.error('[booth/leads]', err instanceof Error ? err.message : err)
    return NextResponse.json({ ok: true, warn: 'lead not saved' })
  }
}
