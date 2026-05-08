import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

// Public GET — booth fetches active filters
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('booth_filters')
    .select('id, name, emoji, description, prompt')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ filters: data })
}

// Auth POST — create new filter
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, emoji, description, prompt, sort_order } = body
  if (!name || !prompt) return NextResponse.json({ error: 'name and prompt required' }, { status: 400 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('booth_filters')
    .insert({ name, emoji: emoji || '✨', description: description || '', prompt, sort_order: sort_order ?? 99 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ filter: data })
}
