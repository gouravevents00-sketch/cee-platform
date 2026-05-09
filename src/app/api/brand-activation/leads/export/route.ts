import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const config_id = req.nextUrl.searchParams.get('config_id')
  const svc = createServiceClient()

  let query = svc
    .from('activation_leads')
    .select('name, phone, photo_url, rating, created_at, config_id')
    .order('created_at', { ascending: false })

  if (config_id) query = query.eq('config_id', config_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const header = 'Name,WhatsApp,Rating,Time,Photo URL'
  const csv = [
    header,
    ...rows.map(r =>
      [
        `"${r.name}"`,
        `"${r.phone}"`,
        r.rating ?? '',
        `"${new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}"`,
        `"${r.photo_url ?? ''}"`,
      ].join(',')
    ),
  ].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="activation-leads-${config_id ?? 'all'}.csv"`,
    },
  })
}
