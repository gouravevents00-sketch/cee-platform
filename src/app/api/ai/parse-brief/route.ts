import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['director', 'accounts', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const { brief, eventName } = await req.json()
  if (!brief?.trim()) return NextResponse.json({ error: 'Brief required' }, { status: 400 })

  const prompt = `You are a quotation assistant for Creative Era Events, a premium Indian event management company.

A client or tender document has been provided below. Extract all deliverable items and return them as a JSON array of quotation rows.

Event: ${eventName || 'Event'}

Brief / Tender:
${brief}

Return ONLY a JSON array (no markdown, no explanation) with this exact structure:
[
  { "_type": "section", "label": "SECTION NAME" },
  {
    "_type": "item",
    "description": "element name",
    "specs": "material, finish, specs",
    "dim_str": "width×height ft or rft or nos",
    "days": 1,
    "qty": 1,
    "rate": 0
  }
]

Rules:
- Group related items under section headers
- dim_str: use format like "20×10 ft", "15 rft", "2×2 ft" — or leave empty if not mentioned
- days: setup + event days (default 1 if not mentioned)
- qty: quantity count (default 1)
- rate: 0 (director will fill rates)
- specs: material type, finish (e.g. "Flex print", "Backlit vinyl", "3mm PVC")
- Extract ALL items mentioned: stages, backdrops, standees, LED walls, flooring, lighting, decor, branding, etc.
- If a section isn't clear, use "GENERAL" as label`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    const text = data.content?.[0]?.text?.trim()
    if (!text) return NextResponse.json({ error: 'No rows generated' }, { status: 500 })

    // Strip markdown code fences if present
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const rows = JSON.parse(clean)
    return NextResponse.json({ rows })
  } catch {
    return NextResponse.json({ error: 'Failed to parse brief' }, { status: 500 })
  }
}
