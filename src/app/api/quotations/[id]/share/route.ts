import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { autoCompleteTasks, KEYWORDS_QUOTATION_SENT } from '@/lib/autoCompleteTasks'

// POST /api/quotations/[id]/share — generate shareable client view link
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'director') {
    return NextResponse.json({ error: 'Director only' }, { status: 403 })
  }

  // Verify quotation exists
  const { data: quot } = await supabase
    .from('quotations')
    .select('id, event_id, status')
    .eq('id', id)
    .single()

  if (!quot) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })

  // Create or return existing token
  const { data: existing } = await supabase
    .from('quotation_tokens')
    .select('token')
    .eq('quotation_id', id)
    .eq('status', 'pending')
    .single()

  if (existing) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cee-platform.vercel.app'
    return NextResponse.json({ token: existing.token, link: `${baseUrl}/quote/${existing.token}` })
  }

  const { data, error } = await supabase
    .from('quotation_tokens')
    .insert({
      quotation_id: id,
      event_id: quot.event_id,
      created_by: user.id,
    })
    .select('token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-complete "quotation sent" tasks
  await autoCompleteTasks(
    supabase, quot.event_id, user.id, KEYWORDS_QUOTATION_SENT,
    'Auto-completed: Quotation shared with client.'
  )

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cee-platform.vercel.app'
  return NextResponse.json({ token: data.token, link: `${baseUrl}/quote/${data.token}` })
}
