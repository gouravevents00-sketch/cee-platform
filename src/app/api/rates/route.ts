import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET — fetch all active rates
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('rate_master')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('item_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rates: data || [] })
}

// POST — upload/upsert rates from parsed sheet
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['director', 'accounts'].includes(profile.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const contentType = req.headers.get('content-type') || ''

  let rows: any[] = []

  if (contentType.includes('multipart/form-data')) {
    // File upload — parse CSV/Excel
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const text = await file.text()
    rows = parseCSV(text)
  } else {
    // JSON array of rows
    const body = await req.json()
    rows = body.rows || []
  }

  if (!rows.length) return NextResponse.json({ error: 'No rows parsed' }, { status: 400 })

  // Upsert into rate_master
  const toInsert = rows.map(r => ({
    category: r.category?.trim() || 'General',
    item_name: r.item_name?.trim() || '',
    specification: r.specification?.trim() || null,
    unit: r.unit?.trim() || 'unit',
    our_cost: parseFloat(r.our_cost) || 0,
    our_rate: parseFloat(r.our_rate) || 0,
    notes: r.notes?.trim() || null,
    is_active: true,
    created_by: user.id,
  })).filter(r => r.item_name)

  const { data, error } = await supabase
    .from('rate_master')
    .upsert(toInsert, { onConflict: 'category,item_name' })
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ inserted: data?.length || 0 })
}

// DELETE — deactivate a rate
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await supabase.from('rate_master').update({ is_active: false }).eq('id', id)
  return NextResponse.json({ success: true })
}

function parseCSV(text: string): any[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  // Detect header row
  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/[^a-z_]/g, '_'))

  const colMap: Record<string, string> = {
    category: 'category',
    item_name: 'item_name',
    'item name': 'item_name',
    specification: 'specification',
    specs: 'specification',
    unit: 'unit',
    our_cost: 'our_cost',
    'our cost': 'our_cost',
    'our cost (₹)': 'our_cost',
    our_rate: 'our_rate',
    'our rate': 'our_rate',
    'our rate (₹)': 'our_rate',
    notes: 'notes',
  }

  const headerKeys = lines[0].split(',').map(h => {
    const clean = h.trim().replace(/\(.*?\)/g, '').replace(/[₹]/g, '').trim().toLowerCase()
    return colMap[clean] || clean
  })

  return lines.slice(1).map(line => {
    const vals = line.split(',')
    const obj: any = {}
    headerKeys.forEach((key, i) => {
      obj[key] = (vals[i] || '').trim().replace(/^"|"$/g, '')
    })
    return obj
  }).filter(r => r.item_name || r['item name'])
}
