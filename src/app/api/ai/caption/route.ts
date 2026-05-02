import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const { platform, content_type, event_name, client_name, notes } = await req.json()

  const platformTone: Record<string, string> = {
    instagram: 'engaging, visual, uses 5-8 relevant emojis, includes 8-12 hashtags at the end',
    linkedin: 'professional, storytelling tone, no emojis, ends with 3-5 industry hashtags',
    youtube: 'exciting, descriptive, includes keywords naturally, no hashtags',
    whatsapp: 'conversational, warm, no hashtags, 2-3 lines max',
    other: 'engaging and professional',
  }

  const tone = platformTone[platform] || platformTone.other

  const prompt = `You are a social media content writer for Creative Era Events, a premium event management company based in India.

Write a ${platform} caption for a ${content_type || 'post'} about:
- Event: ${event_name || 'a recent event'}
${client_name ? `- Client: ${client_name}` : ''}
${notes ? `- Details: ${notes}` : ''}

Requirements:
- Tone: ${tone}
- Language: Hinglish or English (whichever feels more natural for the platform and audience)
- Keep it authentic — like a real post, not a template
- For Instagram: caption should make people stop scrolling
- For LinkedIn: share a professional insight or story
- Do NOT include placeholder text like [event name] — use the actual details given

Write ONLY the caption text, nothing else.`

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
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    const caption = data.content?.[0]?.text?.trim()
    if (!caption) return NextResponse.json({ error: 'No caption generated' }, { status: 500 })

    return NextResponse.json({ caption })
  } catch (err) {
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
  }
}
