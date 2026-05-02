import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const { client_name, contact_name, client_type, event_name, amount, payment_type, days_overdue, urgency } = await req.json()

  const urgencyGuide: Record<string, string> = {
    friendly: 'warm and polite — assume they just forgot, keep it light',
    firm: 'professional but firm — clearly state this needs action soon',
    formal: 'serious and formal — this is a final reminder before escalation',
  }

  const prompt = `You are writing a WhatsApp follow-up message on behalf of Creative Era Events, a professional event management company.

Context:
- Client: ${client_name}${contact_name ? ` (Contact: ${contact_name})` : ''}
- Client type: ${client_type}
- Event: ${event_name}
- Outstanding: ₹${amount?.toLocaleString('en-IN')} (${payment_type} payment)
- Days overdue: ${days_overdue > 0 ? days_overdue + ' days overdue' : 'due soon'}
- Urgency: ${urgency} — ${urgencyGuide[urgency] || urgencyGuide.friendly}

Write a personalized WhatsApp message that:
1. Addresses ${contact_name || 'the contact'} by name
2. References the specific event and amount
3. Matches the urgency tone: ${urgencyGuide[urgency]}
4. For government/corporate: use formal language; for agency/individual: can be Hinglish
5. Ends with Creative Era Events sign-off
6. Uses WhatsApp bold (*text*) for important numbers and event name
7. Is 3-6 lines — short and scannable
8. Feels PERSONAL, not copy-paste

Write ONLY the message text, nothing else.`

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
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    const message = data.content?.[0]?.text?.trim()
    if (!message) return NextResponse.json({ error: 'No message generated' }, { status: 500 })

    return NextResponse.json({ message })
  } catch {
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
  }
}
