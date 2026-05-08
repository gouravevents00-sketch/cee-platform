import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

// ─── File Text Extraction ─────────────────────────────────────────────────────

async function extractTextFromFile(file: File): Promise<{ text?: string; base64?: string; mediaType?: string }> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const name = file.name.toLowerCase()

  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(buffer, { type: 'buffer' })
    let text = ''
    for (const sheet of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '' }) as any[][]
      text += rows.map(r => r.map((c: any) => String(c ?? '').trim()).filter(Boolean).join(' | ')).filter(Boolean).join('\n') + '\n'
    }
    return { text: text.trim() }
  }

  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return { text: result.value.trim() }
  }

  if (name.endsWith('.pdf')) {
    // Send directly to Claude as a document
    return { base64: buffer.toString('base64'), mediaType: 'application/pdf' }
  }

  if (name.match(/\.(jpg|jpeg|png|webp|gif)$/)) {
    const mt = name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
    return { base64: buffer.toString('base64'), mediaType: mt }
  }

  return { text: buffer.toString('utf-8').slice(0, 8000) }
}

// ─── Parse Action ─────────────────────────────────────────────────────────────

async function parseBrief(formData: FormData): Promise<NextResponse> {
  const name = formData.get('name') as string
  const company = formData.get('company') as string
  const eventType = formData.get('event_type') as string
  const eventDate = formData.get('event_date') as string
  const city = formData.get('city') as string
  const guestCount = formData.get('guest_count') as string
  const budget = formData.get('budget') as string
  const description = formData.get('description') as string
  const file = formData.get('file') as File | null

  const context = [
    name && `Client: ${name}${company ? ` (${company})` : ''}`,
    eventType && `Event type: ${eventType}`,
    eventDate && `Date: ${eventDate}`,
    city && `City: ${city}`,
    guestCount && `Approx guests: ${guestCount}`,
    budget && `Budget range: ${budget}`,
    description && `Client's description: ${description}`,
  ].filter(Boolean).join('\n')

  // Build Claude message content
  const messageContent: any[] = []

  if (file && file.size > 0) {
    const extracted = await extractTextFromFile(file)

    if (extracted.base64 && extracted.mediaType) {
      // PDF or image — send as native content
      const contentType = extracted.mediaType.startsWith('image/') ? 'image' : 'document'
      messageContent.push({
        type: contentType,
        source: { type: 'base64', media_type: extracted.mediaType, data: extracted.base64 },
      })
    } else if (extracted.text) {
      messageContent.push({ type: 'text', text: `Uploaded file content:\n${extracted.text.slice(0, 6000)}` })
    }
  }

  messageContent.push({
    type: 'text',
    text: `You are an event management intake assistant for Creative Era Events, a premium Indian event company.

A prospective client has submitted the following information:
${context}

${file ? 'Please analyze the uploaded document/file above along with the client information.' : ''}

Based on everything provided, create a structured brief. Return ONLY valid JSON in this exact format:
{
  "event_summary": "One clear sentence describing the event and what's needed",
  "event_type": "conference | product_launch | award_ceremony | brand_activation | inauguration | exhibition | wedding | other",
  "confirmed_details": {
    "date": "date or null",
    "city": "city or null",
    "guest_count": "number or range or null",
    "budget_range": "range or null"
  },
  "key_requirements": ["requirement 1", "requirement 2", "requirement 3"],
  "clarifications_needed": ["question if genuinely unclear — max 2, empty array if all clear"]
}

Rules:
- key_requirements: extract the most important deliverables from the brief (3-6 items)
- Be specific: "LED stage backdrop 20×10ft" not just "backdrop"
- If file has an element sheet, list the main categories
- Keep event_summary under 20 words`,
  })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: messageContent }],
    }),
  })

  if (!res.ok) return NextResponse.json({ error: 'AI analysis failed.' }, { status: 500 })

  const data = await res.json()
  const raw = data.content?.[0]?.text?.trim() ?? ''
  const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const brief = JSON.parse(clean)
    return NextResponse.json({ brief })
  } catch {
    return NextResponse.json({ error: 'Could not parse AI response.' }, { status: 500 })
  }
}

// ─── Submit Action ────────────────────────────────────────────────────────────

async function submitBrief(formData: FormData): Promise<NextResponse> {
  const contactName = formData.get('name') as string
  const company = formData.get('company') as string
  const phone = formData.get('phone') as string
  const email = formData.get('email') as string
  const eventType = formData.get('event_type') as string
  const estBudget = parseFloat(formData.get('est_budget') as string) || 0
  const briefJson = formData.get('brief') as string

  let briefData: any = {}
  try { briefData = JSON.parse(briefJson) } catch { /* ignore */ }

  const notes = [
    briefData.event_summary && `Summary: ${briefData.event_summary}`,
    briefData.key_requirements?.length && `Requirements:\n${briefData.key_requirements.map((r: string) => `• ${r}`).join('\n')}`,
    briefData.clarifications_needed?.length && `Clarifications needed:\n${briefData.clarifications_needed.map((q: string) => `• ${q}`).join('\n')}`,
  ].filter(Boolean).join('\n\n')

  // Create lead
  const { data: lead, error } = await db.from('leads').insert({
    name: briefData.event_summary || `${eventType} — ${company || contactName}`,
    company,
    contact_name: contactName,
    contact_phone: phone,
    contact_email: email,
    event_type: briefData.event_type || eventType,
    est_budget: estBudget,
    source: 'other',
    status: 'new',
    notes: `[CEE AI Brief Tool]\n\n${notes}`,
  }).select('id').single()

  if (error) return NextResponse.json({ error: 'Failed to save brief.' }, { status: 500 })

  // Notify all directors
  const { data: directors } = await db.from('profiles').select('id').eq('role', 'director')
  if (directors?.length) {
    await db.from('notifications').insert(
      directors.map(d => ({
        user_id: d.id,
        title: `New brief received — ${company || contactName}`,
        body: briefData.event_summary || `${eventType} enquiry`,
        link: '/dashboard/sales',
        read: false,
      }))
    )
  }

  return NextResponse.json({ ok: true, lead_id: lead.id })
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured.' }, { status: 500 })

  const formData = await req.formData()
  const action = formData.get('action') as string

  if (action === 'parse') return parseBrief(formData)
  if (action === 'submit') return submitBrief(formData)

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
}
