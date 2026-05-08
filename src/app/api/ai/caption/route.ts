import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const { platform, content_type, event_name, client_name, notes } = await req.json()

  const platformRules: Record<string, string> = {
    instagram: `Format: Hook line (stop-scrolling first line) → 2-3 lines of story/context → CTA or tagline → blank line → hashtag block.
Tone: Natural Hinglish or English, whichever feels human — not corporate.
Emojis: 4-6 placed naturally in the body (not at start of every line).
Hashtags: 15-20 in a separate paragraph at the end. Mix: #CreativeEraEvents + niche event tags + #IndoreEvents + #EventManagement + content-specific tags.
Hook rule: First line must make someone stop scrolling — ask a question, make a bold statement, or paint a visual. Example hooks: "Iss stage ne 1200 logon ko chaukaa diya." or "What happens when a 40ft LED wall meets a concert crowd?"`,

    linkedin: `Format: Opening hook (1 punchy line) → story or insight (3-5 lines) → lesson/takeaway → soft CTA.
Tone: Professional but human. Like Gourav Maheswari (Director, Creative Era Events) sharing a real business reflection — not a press release.
No emojis in body. One optional at end only.
Hashtags: 4-5, industry-relevant only. #EventManagement #CorporateEvents #IndoreEvents #CreativeEraEvents
Avoid: vague adjectives like "amazing", "incredible", "proud". Show specifics instead.`,

    youtube: `First 2 lines must contain keywords naturally (they show in search previews).
Full description with event context, what was delivered, scale (guests, sq.ft, days).
Include: company name, city, event type.
End with: "Subscribe for more event production content from Creative Era Events | Indore"
No hashtags in description body — add 3-5 as separate tags at end.`,

    whatsapp: `2-4 lines max. Direct and warm — like a message from Gourav personally, not a brand account.
No hashtags. Minimal emojis (1-2 max).
Tone: Informal but professional. Hinglish is fine.
Must feel like a real person wrote it, not a template.`,

    facebook: `Slightly longer than Instagram. Narrative, warm tone — many followers are Indore locals who know CEE personally.
Tell a short story. Use line breaks for readability.
Hashtags: 8-12. Mix local + industry.
Can tag location: Indore, Madhya Pradesh.`,

    other: `Professional, engaging, clear. Reflects the quality and premium positioning of Creative Era Events.`,
  }

  const rules = platformRules[platform] || platformRules.other

  const systemPrompt = `You are the dedicated social media writer for Creative Era Events (CEE) and Creative Era Experiences (CEX) — a 13-year-old premium event management company based in Indore, Madhya Pradesh. Director: Gourav Maheswari.

CEE handles corporate events, government events, public events — stages, fabrication, LED walls, lighting, sound, branding, flooring, decor. CEX handles experience tech — AI stages, robo dogs, selfie booths, guest management apps, unique installations.

Your writing makes CEE look like the most innovative, reliable event company in central India. Every post feels like it was written by someone who was actually at the event and cared about it — never generic, never template-y.

NEVER write placeholder text like [client name] or [date] — use the actual details given or make a smart inference.
NEVER start a post with "We are proud to share" or "We are delighted".
NEVER use: "Amazing", "Incredible", "Truly" — show specifics instead.
If scale numbers are given (guests, sq.ft, hours, days) — use them. Numbers are powerful.`

  const userPrompt = `Write a ${platform} caption for a ${content_type || 'post'} about:
- Event: ${event_name || 'a recent Creative Era Events production'}
${client_name ? `- Client: ${client_name}` : ''}
${notes ? `- Details / notes: ${notes}` : ''}

${platform.toUpperCase()} RULES:
${rules}

Output ONLY the caption text (and hashtag block if applicable). Nothing else — no intro, no explanation.`

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
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const data = await res.json()
    const caption = data.content?.[0]?.text?.trim()
    if (!caption) return NextResponse.json({ error: 'No caption generated' }, { status: 500 })

    return NextResponse.json({ caption })
  } catch {
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
  }
}
