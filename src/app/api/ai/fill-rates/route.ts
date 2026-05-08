import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!
const MODEL = 'claude-haiku-4-5-20251001'

// POST /api/ai/fill-rates
// Takes current quotation rows, looks at historical locked quotations,
// and returns AI-suggested rates for each item.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['director', 'accounts'].includes(profile.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const { rows } = await req.json()
  if (!rows?.length) return NextResponse.json({ error: 'No rows provided' }, { status: 400 })

  // Pull rate master (primary source)
  const { data: masterRates } = await supabase
    .from('rate_master')
    .select('category, item_name, specification, unit, our_cost, our_rate')
    .eq('is_active', true)
    .order('category')

  // Pull last 20 locked quotations as secondary source
  const { data: historicalQuots } = await supabase
    .from('quotations')
    .select('items, total, created_at')
    .eq('status', 'accepted')
    .not('locked_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  // Build rate master summary
  const masterLines = (masterRates || [])
    .map(r => `"${r.item_name}"${r.specification ? ` (${r.specification})` : ''} | ${r.unit} | cost: ₹${r.our_cost} | rate: ₹${r.our_rate}`)
    .join('\n')

  // Build historical rate history as fallback
  const rateHistory: Record<string, number[]> = {}
  for (const quot of historicalQuots || []) {
    for (const item of quot.items || []) {
      if (item._type !== 'item' || !item.description || item.rate <= 0) continue
      const key = item.description.toLowerCase().trim().replace(/\s+/g, ' ')
      if (!rateHistory[key]) rateHistory[key] = []
      rateHistory[key].push(item.rate)
    }
  }

  const historicalLines = Object.entries(rateHistory)
    .slice(0, 40)
    .map(([name, rates]) => {
      const avg = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
      return `"${name}" → avg ₹${avg} (${rates.length} past quotes)`
    })
    .join('\n')

  const rateSummaryLines = [
    masterLines ? `=== RATE MASTER (use these first) ===\n${masterLines}` : '',
    historicalLines ? `\n=== HISTORICAL QUOTATIONS (fallback) ===\n${historicalLines}` : '',
  ].filter(Boolean).join('\n')

  const itemsToPrice = rows
    .filter((r: any) => r._type === 'item' && r.description?.trim() && !r.is_lumpsum)
    .map((r: any, i: number) => `${i + 1}. ${r.description}${r.specs ? ` (${r.specs})` : ''}${r.dim_str ? ` | ${r.dim_str}` : ''} | qty:${r.qty || 1} days:${r.days || 1}`)
    .join('\n')

  if (!itemsToPrice) return NextResponse.json({ suggestions: [] })

  const prompt = `You are a pricing assistant for Creative Era Events, an Indian event management company based in Indore.

## Historical Rate Data (from past locked quotations):
${rateSummaryLines || 'No historical data available yet.'}

## Items to Price (current quotation):
${itemsToPrice}

## Task:
For each numbered item above, suggest a CLIENT RATE (what we charge the client, in INR) and a VENDOR RATE (what we pay the vendor/cost, in INR).

Rules:
- Base suggestions on historical data if available. If no history, use Indian market rates for event production in Indore/MP.
- Rates should be per unit (per sq.ft for area-based, per piece for items, per day for services, etc.)
- Client rate = vendor rate + 20-40% margin typically
- Sound/AV/Lighting: typical vendor cost ₹15,000–₹80,000 per day depending on scale
- Stage backdrop per sq.ft: client ₹180–₹280, vendor ₹100–₹160
- LED screen per sq.ft per day: client ₹350–₹600, vendor ₹200–₹400
- Branding/flex per sq.ft: client ₹80–₹120, vendor ₹40–₹70
- Manpower per person per day: client ₹1,500–₹2,500, vendor ₹800–₹1,500
- Transport/truck per trip: client ₹5,000–₹12,000, vendor ₹3,000–₹8,000

Respond ONLY with a JSON array. Each object must have:
{
  "index": <number from the list, 1-based>,
  "client_rate": <number>,
  "vendor_rate": <number>,
  "note": "<brief reason, max 8 words>"
}

No extra text. Valid JSON only.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    const text = data.content?.[0]?.text?.trim() || '[]'

    // Strip markdown code block if present
    const jsonStr = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const suggestions = JSON.parse(jsonStr)

    return NextResponse.json({ suggestions })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'AI rate fill failed' }, { status: 500 })
  }
}
